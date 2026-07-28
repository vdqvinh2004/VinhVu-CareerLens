import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");

await migrate(db, { migrationsFolder });
await pool.end();
