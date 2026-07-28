import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const cookieValues = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieValues.get(name);
      return value ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      cookieValues.set(name, value);
    },
    delete: (name: string) => {
      cookieValues.delete(name);
    },
  }),
}));

describe("Redis authentication primitives", () => {
  beforeAll(() => {
    process.env.REDIS_URL ||= "redis://localhost:6379";
    process.env.REDIS_KEY_PREFIX = `mm:test:${Date.now()}`;
    process.env.RATE_LIMIT_HMAC_KEY = Buffer.alloc(32, 3).toString("base64");
    process.env.SESSION_HMAC_KEYS = `test:${Buffer.alloc(32, 4).toString("base64")}`;
  });

  afterAll(async () => {
    const { closeRedisConnection } = await import("@/lib/redis");
    await closeRedisConnection();
  });

  it("applies a distributed token bucket atomically", async () => {
    const { checkRateLimit } = await import("@/lib/auth/rate-limit");
    const policy = {
      capacity: 2,
      refillTokens: 2,
      refillIntervalMs: 60_000,
    };

    const first = await checkRateLimit("test", "same-identity", policy);
    const second = await checkRateLimit("test", "same-identity", policy);
    const third = await checkRateLimit("test", "same-identity", policy);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it("creates, reads, and revokes an opaque user session", async () => {
    const { createSession, getSession, revokeCurrentSession } = await import(
      "@/lib/auth/session"
    );
    const actor = {
      kind: "user" as const,
      userId: "11111111-1111-4111-8111-111111111111",
      authVersion: 1,
    };

    await createSession(actor);
    const session = await getSession();

    expect(session?.actor).toEqual(actor);
    expect(cookieValues.get("mm_session")).toMatch(/^v1\.test\./);

    await revokeCurrentSession();
    expect(await getSession()).toBeNull();
    expect(cookieValues.has("mm_session")).toBe(false);
  });
});
