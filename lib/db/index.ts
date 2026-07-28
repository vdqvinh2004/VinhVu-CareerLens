import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const globalForDatabase = globalThis as typeof globalThis & {
  postgresPool?: Pool;
};

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }

  return databaseUrl;
}

function createDatabase() {
  const pool =
    globalForDatabase.postgresPool ??
    new Pool({
      connectionString: getDatabaseUrl(),
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDatabase.postgresPool = pool;
  }

  return drizzle(pool, { schema });
}

let database: ReturnType<typeof createDatabase> | undefined;

export function getDb() {
  database ??= createDatabase();
  return database;
}
