import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { getRedis } from "@/lib/redis";

import type { Actor } from "./actor";
import { getActorSubject } from "./actor";
import { getSessionCookieName, getSessionKeys } from "./config";
import { createOpaqueToken, hmacSha256, sha256 } from "./crypto";
import {
  principalSessionsKey,
  principalSessionsKeyPrefix,
  sessionKey,
  sessionKeyPrefix,
} from "./redis-keys";

const NORMAL_IDLE_MS = 30 * 60 * 1_000;
const NORMAL_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1_000;
const SUPERADMIN_IDLE_MS = 15 * 60 * 1_000;
const SUPERADMIN_ABSOLUTE_MS = 30 * 60 * 1_000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1_000;

const sessionRecordSchema = z.object({
  actor: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("user"),
      userId: z.string().uuid(),
      authVersion: z.number().int().positive(),
    }),
    z.object({
      kind: z.literal("builtin-superadmin"),
      subject: z.literal("builtin:superadmin"),
      credentialVersion: z.number().int().positive(),
    }),
  ]),
  principalDigest: z.string().min(1),
  mfaLevel: z.number().int().min(0),
  idleMs: z.number().int().positive(),
  createdAt: z.number().int().positive(),
  lastSeenAt: z.number().int().positive(),
  absoluteExpiresAt: z.number().int().positive(),
});

export type SessionRecord = z.infer<typeof sessionRecordSchema>;

const CREATE_SESSION_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local absolute_expiry = now + tonumber(ARGV[4])
local idle_ms = tonumber(ARGV[5])
local effective_expiry = math.min(absolute_expiry, now + idle_ms)
local session = cjson.decode(ARGV[3])
session.createdAt = now
session.lastSeenAt = now
session.absoluteExpiresAt = absolute_expiry
local value = cjson.encode(session)
local created = redis.call('SET', KEYS[1], value, 'PXAT', effective_expiry, 'NX')
if not created then return 0 end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
redis.call('ZADD', KEYS[2], effective_expiry, ARGV[2])
local overflow = redis.call('ZCARD', KEYS[2]) - tonumber(ARGV[6])
if overflow > 0 then
  local expired = redis.call('ZRANGE', KEYS[2], 0, overflow - 1)
  for _, digest in ipairs(expired) do
    redis.call('DEL', ARGV[1] .. digest)
    redis.call('ZREM', KEYS[2], digest)
  end
end
local latest = redis.call('ZREVRANGE', KEYS[2], 0, 0, 'WITHSCORES')
if latest[2] then redis.call('PEXPIREAT', KEYS[2], latest[2]) end
return value
`;

const READ_SESSION_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if not value then return nil end
local session = cjson.decode(value)
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local idle_ms = session.idleMs
if now >= session.absoluteExpiresAt or now - session.lastSeenAt >= idle_ms then
  redis.call('DEL', KEYS[1])
  local index_key = ARGV[1] .. session.principalDigest .. ':sessions'
  redis.call('ZREM', index_key, ARGV[2])
  return nil
end
if now - session.lastSeenAt >= tonumber(ARGV[3]) then
  session.lastSeenAt = now
  value = cjson.encode(session)
  local effective_expiry = math.min(session.absoluteExpiresAt, now + idle_ms)
  redis.call('SET', KEYS[1], value, 'PXAT', effective_expiry)
  local index_key = ARGV[1] .. session.principalDigest .. ':sessions'
  redis.call('ZADD', index_key, effective_expiry, ARGV[2])
  local latest = redis.call('ZREVRANGE', index_key, 0, 0, 'WITHSCORES')
  if latest[2] then redis.call('PEXPIREAT', index_key, latest[2]) end
end
return value
`;

const REVOKE_SESSION_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if not value then return 0 end
local session = cjson.decode(value)
redis.call('DEL', KEYS[1])
local index_key = ARGV[1] .. session.principalDigest .. ':sessions'
redis.call('ZREM', index_key, ARGV[2])
if redis.call('ZCARD', index_key) == 0 then redis.call('DEL', index_key) end
return 1
`;

const REVOKE_ALL_SCRIPT = `
local digests = redis.call('ZRANGE', KEYS[1], 0, -1)
for _, digest in ipairs(digests) do
  redis.call('UNLINK', ARGV[1] .. digest)
end
redis.call('DEL', KEYS[1])
return #digests
`;

function sessionPolicy(actor: Actor) {
  return actor.kind === "user"
    ? { idleMs: NORMAL_IDLE_MS, absoluteMs: NORMAL_ABSOLUTE_MS, maxSessions: 10 }
    : {
        idleMs: SUPERADMIN_IDLE_MS,
        absoluteMs: SUPERADMIN_ABSOLUTE_MS,
        maxSessions: 2,
      };
}

function parseCookie(value: string) {
  const [version, keyId, token, extra] = value.split(".");

  if (version !== "v1" || !keyId || !token || extra) {
    return null;
  }

  const key = getSessionKeys().find((candidate) => candidate.id === keyId);
  return key ? { token, key } : null;
}

function digestSessionToken(token: string, secret: Buffer) {
  return hmacSha256(`session:${token}`, secret);
}

export async function createSession(actor: Actor, mfaLevel = 1) {
  const redis = await getRedis();
  const [activeKey] = getSessionKeys();
  const token = createOpaqueToken();
  const digest = digestSessionToken(token, activeKey.secret);
  const policy = sessionPolicy(actor);
  const principalDigest = sha256(`${actor.kind}:${getActorSubject(actor)}`);
  const recordInput: SessionRecord = {
    actor,
    principalDigest,
    mfaLevel,
    idleMs: policy.idleMs,
    createdAt: 1,
    lastSeenAt: 1,
    absoluteExpiresAt: 1,
  };

  const result = await redis.eval(CREATE_SESSION_SCRIPT, {
    keys: [sessionKey(digest), principalSessionsKey(principalDigest)],
    arguments: [
      sessionKeyPrefix(),
      digest,
      JSON.stringify(recordInput),
      String(policy.absoluteMs),
      String(policy.idleMs),
      String(policy.maxSessions),
    ],
  });

  if (typeof result !== "string") {
    throw new Error("Could not create a unique session");
  }

  const record = sessionRecordSchema.parse(JSON.parse(result));

  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), `v1.${activeKey.id}.${token}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(record.absoluteExpiresAt),
    priority: "high",
  });

  return record;
}

export async function getSession(): Promise<SessionRecord | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(getSessionCookieName())?.value;

  if (!value) {
    return null;
  }

  const parsedCookie = parseCookie(value);

  if (!parsedCookie) {
    return null;
  }

  const digest = digestSessionToken(parsedCookie.token, parsedCookie.key.secret);
  const redis = await getRedis();
  const rawSession = await redis.eval(READ_SESSION_SCRIPT, {
    keys: [sessionKey(digest)],
    arguments: [
      principalSessionsKeyPrefix(),
      digest,
      String(TOUCH_INTERVAL_MS),
    ],
  });

  if (typeof rawSession !== "string") {
    return null;
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(rawSession);
  } catch {
    await redis.del(sessionKey(digest));
    return null;
  }

  const parsed = sessionRecordSchema.safeParse(decoded);

  if (!parsed.success) {
    await redis.del(sessionKey(digest));
    return null;
  }

  return parsed.data;
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(getSessionCookieName())?.value;

  try {
    if (value) {
      const parsed = parseCookie(value);

      if (parsed) {
        const digest = digestSessionToken(parsed.token, parsed.key.secret);
        const redis = await getRedis();
        await redis.eval(REVOKE_SESSION_SCRIPT, {
          keys: [sessionKey(digest)],
          arguments: [principalSessionsKeyPrefix(), digest],
        });
      }
    }
  } finally {
    cookieStore.delete(getSessionCookieName());
  }
}

export async function revokeAllSessions(actor: Actor) {
  const redis = await getRedis();
  const principalDigest = sha256(`${actor.kind}:${getActorSubject(actor)}`);
  return redis.eval(REVOKE_ALL_SCRIPT, {
    keys: [principalSessionsKey(principalDigest)],
    arguments: [sessionKeyPrefix()],
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(getSessionCookieName());
}
