import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const { config } = require("dotenv");

config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env"), quiet: true });

const { drizzle } = await import("drizzle-orm/node-postgres");
const { migrate } = await import("drizzle-orm/node-postgres/migrator");
const pg = await import("pg");

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL in .env");

const pool = new pg.default.Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");

console.log("Running migrations from:", migrationsFolder);
await migrate(db, { migrationsFolder });
console.log("Migrations applied successfully.");
await pool.end();
