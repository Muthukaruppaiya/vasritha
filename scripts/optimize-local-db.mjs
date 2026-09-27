/**
 * Apply DBA optimize scripts against the local database.
 * Runs optimize_v1.sql then optimize_v2.sql (idempotent).
 * Usage: npm run db:optimize
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5433/vasritha";

const files = ["optimize_v1.sql", "optimize_v2.sql"].map((name) =>
  path.join(root, "db", "local", name)
);

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  for (const sqlPath of files) {
    if (!fs.existsSync(sqlPath)) {
      console.warn("Skip missing:", path.basename(sqlPath));
      continue;
    }
    const sql = fs.readFileSync(sqlPath, "utf8");
    await client.query(sql);
    console.log("Applied:", path.basename(sqlPath));
  }
  console.log("DB optimize complete.");
  console.log("Database:", databaseUrl.replace(/:[^:@/]+@/, ":****@"));
} catch (error) {
  console.error("Failed to optimize schema:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
