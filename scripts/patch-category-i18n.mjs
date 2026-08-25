/**
 * Apply category_i18n_v1.sql
 * Usage: npm run db:patch:category-i18n
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sqlPath = path.join(root, "db", "local", "category_i18n_v1.sql");
const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5433/vasritha";

const sql = fs.readFileSync(sqlPath, "utf8");
const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query(sql);
  console.log("Category name translations (name_i18n) applied.");
} catch (error) {
  console.error("Failed to apply category i18n patch:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
