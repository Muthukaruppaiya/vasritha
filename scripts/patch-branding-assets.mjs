/**
 * Apply branding_assets_v1.sql (category image_path + header_logo_path).
 * Usage: npm run db:patch:branding
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sqlPath = path.join(root, "db", "local", "branding_assets_v1.sql");
const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5433/vasritha";

const sql = fs.readFileSync(sqlPath, "utf8");
const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query(sql);
  console.log("Branding assets columns applied (categories.image_path, site_settings.header_logo_path).");
} catch (error) {
  console.error("Failed to apply branding patch:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
