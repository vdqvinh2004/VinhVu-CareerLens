import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { config } = require("dotenv");

config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env"),
  quiet: true,
});

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to reset a database while NODE_ENV=production");
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("Missing DATABASE_URL in .env");

const target = new URL(databaseUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (!localHosts.has(target.hostname)) {
  throw new Error(
    `Refusing to reset non-local database host ${target.hostname}. Use a local development database.`,
  );
}

const { Pool } = await import("pg");
const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();

try {
  await client.query("begin");
  await client.query("drop schema if exists drizzle cascade");
  await client.query("drop schema if exists public cascade");
  await client.query("create schema public");
  await client.query("grant all on schema public to current_user");
  await client.query("grant all on schema public to public");
  await client.query("commit");

  console.log(
    `Completely reset ${target.pathname.slice(1)} on ${target.hostname}.`,
  );
  console.log("All tables, types, data, and Drizzle migration history were removed.");
  console.log("Run `npm run db:migrate` to recreate the database.");
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
