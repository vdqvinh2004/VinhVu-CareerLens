import "server-only";

type SessionKey = {
  id: string;
  secret: Buffer;
};

function required(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function decodeSecret(name: string, value = required(name)) {
  const secret = Buffer.from(value, "base64");

  if (secret.length < 32) {
    throw new Error(`${name} must contain at least 32 random bytes in base64`);
  }

  return secret;
}

export function getRedisKeyPrefix() {
  const prefix = process.env.REDIS_KEY_PREFIX?.trim();

  if (!prefix && process.env.NODE_ENV === "production") {
    throw new Error("Missing required environment variable: REDIS_KEY_PREFIX");
  }

  return prefix || "mm:development:v1";
}

export function getSessionKeys(): SessionKey[] {
  const keys = required("SESSION_HMAC_KEYS")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf(":");

      if (separator <= 0) {
        throw new Error("SESSION_HMAC_KEYS entries must use id:base64 format");
      }

      const id = entry.slice(0, separator);
      const secret = decodeSecret("SESSION_HMAC_KEYS", entry.slice(separator + 1));

      if (!/^[a-zA-Z0-9_-]{1,16}$/.test(id)) {
        throw new Error("Session key IDs must be 1-16 URL-safe characters");
      }

      return { id, secret };
    });

  if (new Set(keys.map((key) => key.id)).size !== keys.length) {
    throw new Error("SESSION_HMAC_KEYS contains duplicate key IDs");
  }

  return keys;
}

export function getRateLimitSecret() {
  return decodeSecret("RATE_LIMIT_HMAC_KEY");
}

export function getResetTokenSecret() {
  return decodeSecret("RESET_TOKEN_HMAC_KEY");
}

export function getAppUrl() {
  const configuredUrl = process.env.APP_URL?.trim();

  if (!configuredUrl && process.env.NODE_ENV === "production") {
    throw new Error("Missing required environment variable: APP_URL");
  }

  const url = new URL(configuredUrl || "http://localhost:3000");

  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("APP_URL must use HTTPS in production");
  }

  return url;
}

export function trustProxyHeaders() {
  return process.env.AUTH_TRUST_PROXY_HEADERS === "true";
}

export function getSuperadminConfig() {
  const credentialVersion = Number(required("SUPERADMIN_CREDENTIAL_VERSION"));

  if (!Number.isSafeInteger(credentialVersion) || credentialVersion < 1) {
    throw new Error("SUPERADMIN_CREDENTIAL_VERSION must be a positive integer");
  }

  return {
    identifier: required("SUPERADMIN_IDENTIFIER"),
    passwordHash: required("SUPERADMIN_PASSWORD_HASH"),
    totpSecret: required("SUPERADMIN_TOTP_SECRET"),
    credentialVersion,
  };
}

export function getSessionCookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Host-mm_session"
    : "mm_session";
}
