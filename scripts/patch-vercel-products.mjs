/**
 * Bootstrap hosted Postgres for admin product create (Vercel / Supabase).
 * Usage: DATABASE_URL=postgresql://... npm run db:patch:vercel-products
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, "..", "db", "local", "vercel_product_bootstrap.sql");
const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5433/vasritha";

const sql = fs.readFileSync(sqlPath, "utf8");
const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query(sql);
  console.log("Vercel product bootstrap applied.");
} catch (error) {
  console.error("Failed to apply Vercel product bootstrap:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
