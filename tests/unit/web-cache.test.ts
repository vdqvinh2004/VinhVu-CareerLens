import { describe, expect, it, vi } from "vitest";

import {
  createWebCache,
  createWebCacheKey,
  WebCacheConfigurationError,
} from "@/lib/ai/web/cache";

function createRedisDouble(initialValue: string | null = null) {
  return {
    get: vi.fn(async () => initialValue),
    set: vi.fn(async () => "OK"),
  };
}

describe("web Redis cache", () => {
  it("builds deterministic versioned SHA-256 keys", () => {
    const first = createWebCacheKey("search", "v1", { query: "jobs", limit: 5 });
    const reordered = createWebCacheKey("search", "v1", {
      limit: 5,
      query: "jobs",
    });
    const nextVersion = createWebCacheKey("search", "v2", {
      query: "jobs",
      limit: 5,
    });

    expect(first).toBe(reordered);
    expect(first).toMatch(/^ai:web-cache:search:v1:[a-f0-9]{64}$/);
    expect(nextVersion).not.toBe(first);
  });

  it("requires a positive configured TTL", () => {
    expect(() =>
      createWebCache({ namespace: "search", version: "v1", ttlSeconds: 0 }),
    ).toThrow(WebCacheConfigurationError);
  });

  it("stores bounded JSON with the mandatory TTL", async () => {
    const redis = createRedisDouble();
    const cache = createWebCache({
      namespace: "extract",
      version: "v1",
      ttlSeconds: 120,
      maxValueBytes: 64,
      redisProvider: async () => redis,
    });

    await expect(cache.set("source", { text: "evidence" })).resolves.toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      cache.key("source"),
      JSON.stringify({ text: "evidence" }),
      { EX: 120 },
    );

    await expect(cache.set("large", { text: "x".repeat(100) })).resolves.toBe(
      false,
    );
    expect(redis.set).toHaveBeenCalledTimes(1);
  });

  it("returns cached JSON and ignores corrupt or oversized values", async () => {
    const validRedis = createRedisDouble(JSON.stringify({ answer: 42 }));
    const validCache = createWebCache({
      namespace: "search",
      version: "v1",
      ttlSeconds: 30,
      redisProvider: async () => validRedis,
    });
    await expect(validCache.get("query")).resolves.toEqual({ answer: 42 });

    for (const value of ["not-json", JSON.stringify("x".repeat(100))]) {
      const redis = createRedisDouble(value);
      const cache = createWebCache({
        namespace: "search",
        version: "v1",
        ttlSeconds: 30,
        maxValueBytes: 16,
        redisProvider: async () => redis,
      });
      await expect(cache.get("query")).resolves.toBeNull();
    }
  });

  it("fails open when Redis get or set is unavailable", async () => {
    const redis = {
      get: vi.fn(async () => {
        throw new Error("offline");
      }),
      set: vi.fn(async () => {
        throw new Error("offline");
      }),
    };
    const cache = createWebCache({
      namespace: "search",
      version: "v1",
      ttlSeconds: 30,
      redisProvider: async () => redis,
    });

    await expect(cache.get("query")).resolves.toBeNull();
    await expect(cache.set("query", { result: true })).resolves.toBe(false);
  });

  it("fails open within the configured timeout when Redis stalls", async () => {
    vi.useFakeTimers();
    try {
      const stalled = new Promise<never>(() => {});
      const redis = {
        get: vi.fn(() => stalled),
        set: vi.fn(() => stalled),
      };
      const cache = createWebCache({
        namespace: "search",
        version: "v1",
        ttlSeconds: 30,
        operationTimeoutMs: 25,
        redisProvider: async () => redis,
      });

      const getResult = cache.get("query");
      const setResult = cache.set("query", { result: true });
      await vi.advanceTimersByTimeAsync(25);

      await expect(getResult).resolves.toBeNull();
      await expect(setResult).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("also times out a stalled Redis provider", async () => {
    vi.useFakeTimers();
    try {
      const cache = createWebCache({
        namespace: "search",
        version: "v1",
        ttlSeconds: 30,
        operationTimeoutMs: 10,
        redisProvider: () => new Promise<never>(() => {}),
      });

      const result = cache.get("query");
      await vi.advanceTimersByTimeAsync(10);
      await expect(result).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
