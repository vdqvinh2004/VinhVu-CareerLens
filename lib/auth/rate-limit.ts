import "server-only";

import { getRedis } from "@/lib/redis";

import { getRateLimitSecret } from "./config";
import { hmacSha256 } from "./crypto";
import { rateLimitKey } from "./redis-keys";

const TOKEN_BUCKET_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local capacity = tonumber(ARGV[1])
local refill_per_ms = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local values = redis.call('HMGET', KEYS[1], 'tokens', 'updated_at')
local tokens = tonumber(values[1]) or capacity
local updated_at = tonumber(values[2]) or now
tokens = math.min(capacity, tokens + math.max(0, now - updated_at) * refill_per_ms)
local allowed = 0
local retry_after = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
else
  retry_after = math.ceil((cost - tokens) / refill_per_ms)
end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'updated_at', now)
redis.call('PEXPIRE', KEYS[1], ttl)
return { allowed, math.floor(tokens), retry_after }
`;

export type RateLimitPolicy = {
  capacity: number;
  refillTokens: number;
  refillIntervalMs: number;
  cost?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export async function checkRateLimit(
  scope: string,
  identity: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const redis = await getRedis();
  const digest = hmacSha256(identity, getRateLimitSecret());
  const refillPerMs = policy.refillTokens / policy.refillIntervalMs;
  const ttl = Math.ceil((policy.capacity / refillPerMs) * 2);
  const response = (await redis.eval(TOKEN_BUCKET_SCRIPT, {
    keys: [rateLimitKey(scope, digest)],
    arguments: [
      String(policy.capacity),
      String(refillPerMs),
      String(policy.cost ?? 1),
      String(ttl),
    ],
  })) as [number, number, number];

  return {
    allowed: response[0] === 1,
    remaining: response[1],
    retryAfterMs: response[2],
  };
}
