import "server-only";

import { createClient } from "redis";

function instantiateRedisClient() {
  return createClient({
    url: getRedisUrl(),
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy(retries) {
        if (retries >= 5) {
          return false;
        }

        return Math.min(2 ** retries * 50, 2_000) + Math.floor(Math.random() * 200);
      },
    },
  });
}

type RedisClient = ReturnType<typeof instantiateRedisClient>;

type RedisGlobal = typeof globalThis & {
  meshMindRedisClient?: RedisClient;
  meshMindRedisConnectPromise?: Promise<RedisClient>;
};

const redisGlobal = globalThis as RedisGlobal;

export class RedisUnavailableError extends Error {
  constructor(message = "Redis is unavailable", options?: ErrorOptions) {
    super(message, options);
    this.name = "RedisUnavailableError";
  }
}

function getRedisUrl() {
  const url = process.env.REDIS_URL?.trim();

  if (!url) {
    throw new RedisUnavailableError(
      "Missing required environment variable: REDIS_URL",
    );
  }

  return url;
}

function createRedisClient() {
  const client = instantiateRedisClient();

  client.on("error", (error) => {
    console.error("Redis client error", {
      name: error.name,
      message: error.message,
    });
  });

  return client;
}

function getClient() {
  const existingClient = redisGlobal.meshMindRedisClient;

  if (existingClient) {
    return existingClient;
  }

  const client = createRedisClient();
  redisGlobal.meshMindRedisClient = client;
  return client;
}

export async function getRedis(): Promise<RedisClient> {
  const client = getClient();

  if (client.isReady) {
    return client;
  }

  if (!client.isOpen) {
    redisGlobal.meshMindRedisConnectPromise ??= client.connect().finally(() => {
      redisGlobal.meshMindRedisConnectPromise = undefined;
    });
  }

  try {
    if (redisGlobal.meshMindRedisConnectPromise) {
      await redisGlobal.meshMindRedisConnectPromise;
    }
  } catch (error) {
    throw new RedisUnavailableError("Could not connect to Redis", { cause: error });
  }

  if (!client.isReady) {
    throw new RedisUnavailableError("Redis is reconnecting");
  }

  return client;
}

export async function verifyRedisConnection() {
  const redis = await getRedis();
  return redis.ping();
}

export async function closeRedisConnection() {
  const client = redisGlobal.meshMindRedisClient;

  if (client?.isOpen) {
    await client.close();
  }

  redisGlobal.meshMindRedisClient = undefined;
  redisGlobal.meshMindRedisConnectPromise = undefined;
}
