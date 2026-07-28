import "server-only";

import * as OTPAuth from "otpauth";

import { getRedis } from "@/lib/redis";

import { getSuperadminConfig } from "./config";
import { createOpaqueToken, sha256 } from "./crypto";
import { verifyPassword } from "./password";
import { mfaChallengeKey, superadminTotpStepKey } from "./redis-keys";

const CHALLENGE_TTL_SECONDS = 5 * 60;
const MAX_CHALLENGE_ATTEMPTS = 5;

const RECORD_FAILURE_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if not value then return -1 end
local challenge = cjson.decode(value)
challenge.attempts = challenge.attempts + 1
if challenge.attempts >= tonumber(ARGV[1]) then
  redis.call('DEL', KEYS[1])
  return 0
end
local ttl = redis.call('PTTL', KEYS[1])
redis.call('SET', KEYS[1], cjson.encode(challenge), 'PX', ttl)
return challenge.attempts
`;

const CONSUME_CHALLENGE_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if not value then return -1 end
local challenge = cjson.decode(value)
if challenge.ipDigest ~= ARGV[1] or challenge.credentialVersion ~= tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1])
  return -2
end
local last_step = tonumber(redis.call('GET', KEYS[2]) or '-1')
local accepted_step = tonumber(ARGV[3])
if accepted_step <= last_step then return -3 end
redis.call('SET', KEYS[2], accepted_step)
redis.call('DEL', KEYS[1])
return 1
`;

export async function verifySuperadminPassword(
  identifier: string,
  password: string,
) {
  const config = getSuperadminConfig();
  const passwordValid = await verifyPassword(config.passwordHash, password);
  const identifierValid = identifier === config.identifier;
  return identifierValid && passwordValid;
}

export async function createSuperadminChallenge(ipDigest: string) {
  const redis = await getRedis();
  const token = createOpaqueToken();
  const digest = sha256(`superadmin-challenge:${token}`);
  const config = getSuperadminConfig();
  const result = await redis.sendCommand([
    "SET",
    mfaChallengeKey(digest),
    JSON.stringify({
      ipDigest,
      credentialVersion: config.credentialVersion,
      attempts: 0,
    }),
    "EX",
    String(CHALLENGE_TTL_SECONDS),
    "NX",
  ]);

  if (String(result) !== "OK") {
    throw new Error("Could not create MFA challenge");
  }

  return token;
}

export async function verifySuperadminTotp(
  challengeToken: string,
  token: string,
  ipDigest: string,
) {
  const redis = await getRedis();
  const challengeDigest = sha256(`superadmin-challenge:${challengeToken}`);
  const challengeKey = mfaChallengeKey(challengeDigest);
  const config = getSuperadminConfig();
  const totp = new OTPAuth.TOTP({
    issuer: "CareerLens",
    label: "Builtin Superadmin",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(config.totpSecret),
  });
  const delta = totp.validate({ token, window: 1 });

  if (delta === null) {
    await redis.eval(RECORD_FAILURE_SCRIPT, {
      keys: [challengeKey],
      arguments: [String(MAX_CHALLENGE_ATTEMPTS)],
    });
    return false;
  }

  const acceptedStep = totp.counter() + delta;
  const result = await redis.eval(CONSUME_CHALLENGE_SCRIPT, {
    keys: [challengeKey, superadminTotpStepKey()],
    arguments: [
      ipDigest,
      String(config.credentialVersion),
      String(acceptedStep),
    ],
  });

  return result === 1;
}
