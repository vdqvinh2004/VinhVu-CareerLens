import { getRedisKeyPrefix } from "./config";

export function sessionKey(digest: string) {
  return `${getRedisKeyPrefix()}:auth:s:${digest}`;
}

export function sessionKeyPrefix() {
  return `${getRedisKeyPrefix()}:auth:s:`;
}

export function principalSessionsKey(principalDigest: string) {
  return `${getRedisKeyPrefix()}:auth:p:${principalDigest}:sessions`;
}

export function principalSessionsKeyPrefix() {
  return `${getRedisKeyPrefix()}:auth:p:`;
}

export function mfaChallengeKey(digest: string) {
  return `${getRedisKeyPrefix()}:auth:challenge:${digest}`;
}

export function superadminTotpStepKey() {
  return `${getRedisKeyPrefix()}:auth:superadmin:totp-step`;
}

export function rateLimitKey(scope: string, digest: string) {
  return `${getRedisKeyPrefix()}:ratelimit:${scope}:${digest}`;
}
