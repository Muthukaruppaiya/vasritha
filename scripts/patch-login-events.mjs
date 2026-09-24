/**
 * Apply login events schema (logged-in users log).
 * Usage: npm run db:patch:login-events
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sqlPath = path.join(root, "db", "local", "login_events_v1.sql");
const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5433/vasritha";

const sql = fs.readFileSync(sqlPath, "utf8");
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: /supabase\.co|sslmode=require/i.test(databaseUrl)
    ? { rejectUnauthorized: false }
    : undefined
});

try {
  await client.connect();
  await client.query(sql);
  console.log("Login events schema applied (login_events).");
} catch (error) {
  console.error("Failed to apply login-events patch:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
