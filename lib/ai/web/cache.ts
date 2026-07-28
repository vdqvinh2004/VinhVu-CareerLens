import "server-only";

import { getRedis } from "@/lib/redis";

import { sha256 } from "./url-policy";

const DEFAULT_MAX_VALUE_BYTES = 256 * 1_024;
const DEFAULT_OPERATION_TIMEOUT_MS = 1_000;
const MAX_KEY_INPUT_BYTES = 64 * 1_024;
const CACHE_PREFIX = "ai:web-cache";

type RedisCacheClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
};

export type WebCacheOptions = {
  namespace: string;
  version: string;
  ttlSeconds: number;
  maxValueBytes?: number;
  operationTimeoutMs?: number;
  redisProvider?: () => Promise<RedisCacheClient>;
};

export type WebCache = {
  key(input: unknown): string;
  get<T>(input: unknown): Promise<T | null>;
  set(input: unknown, value: unknown): Promise<boolean>;
};

export class WebCacheConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebCacheConfigurationError";
  }
}

function assertKeySegment(name: string, value: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value)) {
    throw new WebCacheConfigurationError(
      `${name} must be 1-64 URL-safe characters`,
    );
  }
}

function sortForStableJson(value: unknown, seen: Set<object>): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Cache key numbers must be finite");
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new TypeError("Cache key input must not be circular");
    }

    seen.add(value);
    const sorted = value.map((item) => sortForStableJson(item, seen));
    seen.delete(value);
    return sorted;
  }

  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Cache key objects must be plain objects");
    }

    if (seen.has(value)) {
      throw new TypeError("Cache key input must not be circular");
    }

    seen.add(value);
    const sorted = Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortForStableJson(item, seen)]),
    );
    seen.delete(value);
    return sorted;
  }

  throw new TypeError("Cache key input must be JSON-serializable");
}

function serializeKeyInput(input: unknown) {
  const serialized = JSON.stringify(sortForStableJson(input, new Set()));
  if (Buffer.byteLength(serialized, "utf8") > MAX_KEY_INPUT_BYTES) {
    throw new RangeError("Cache key input exceeds the allowed size");
  }
  return serialized;
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Redis operation timed out")), timeoutMs);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createWebCacheKey(
  namespace: string,
  version: string,
  input: unknown,
) {
  assertKeySegment("namespace", namespace);
  assertKeySegment("version", version);
  return `${CACHE_PREFIX}:${namespace}:${version}:${sha256(serializeKeyInput(input))}`;
}

export function createWebCache(options: WebCacheOptions): WebCache {
  assertKeySegment("namespace", options.namespace);
  assertKeySegment("version", options.version);

  if (!Number.isSafeInteger(options.ttlSeconds) || options.ttlSeconds <= 0) {
    throw new WebCacheConfigurationError("ttlSeconds must be a positive safe integer");
  }

  const maxValueBytes = options.maxValueBytes ?? DEFAULT_MAX_VALUE_BYTES;
  if (!Number.isSafeInteger(maxValueBytes) || maxValueBytes <= 0) {
    throw new WebCacheConfigurationError(
      "maxValueBytes must be a positive safe integer",
    );
  }

  const operationTimeoutMs = options.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS;
  if (!Number.isSafeInteger(operationTimeoutMs) || operationTimeoutMs <= 0) {
    throw new WebCacheConfigurationError(
      "operationTimeoutMs must be a positive safe integer",
    );
  }

  const redisProvider = options.redisProvider ?? getRedis;
  const key = (input: unknown) =>
    createWebCacheKey(options.namespace, options.version, input);

  return {
    key,
    async get<T>(input: unknown) {
      try {
        const serialized = await withTimeout(
          redisProvider().then((redis) => redis.get(key(input))),
          operationTimeoutMs,
        );
        if (
          serialized === null ||
          Buffer.byteLength(serialized, "utf8") > maxValueBytes
        ) {
          return null;
        }

        return JSON.parse(serialized) as T;
      } catch {
        return null;
      }
    },
    async set(input: unknown, value: unknown) {
      try {
        const serialized = JSON.stringify(value);
        if (
          serialized === undefined ||
          Buffer.byteLength(serialized, "utf8") > maxValueBytes
        ) {
          return false;
        }

        await withTimeout(
          redisProvider().then((redis) =>
            redis.set(key(input), serialized, { EX: options.ttlSeconds }),
          ),
          operationTimeoutMs,
        );
        return true;
      } catch {
        return false;
      }
    },
  };
}
