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

function explainDatabaseUrl(url) {
  if (!url || typeof url !== "string") {
    return "DATABASE_URL is missing. Set your hosted Postgres URI, then rerun.";
  }
  if (/\[(ref|password|region)\]/i.test(url)) {
    return [
      "DATABASE_URL still contains placeholder text like [ref], [password], or [region].",
      "Copy the real URI from Supabase → Project Settings → Database → Connection string (URI, port 5432).",
      "Example shape: postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
    ].join(" ");
  }
  if (/YOUR_PROJECT_REF|YOUR_REAL_PASSWORD|YOUR_PASSWORD|xxxx/i.test(url)) {
    return [
      "DATABASE_URL still contains example placeholder text (YOUR_PROJECT_REF, YOUR_REAL_PASSWORD, etc.).",
      "Open Supabase → your project → Project Settings → Database → Connection string.",
      "Choose URI, copy the full string, and paste it — do not type it from the docs example."
    ].join(" ");
  }
  try {
    const parsed = new URL(url);
    if (!/^postgres(ql)?:$/i.test(parsed.protocol)) {
      return "DATABASE_URL must start with postgresql:// or postgres://";
    }
  } catch {
    return "DATABASE_URL is not a valid URL. Check for special characters in the password (URL-encode if needed).";
  }
  return null;
}

const urlError = explainDatabaseUrl(databaseUrl);
if (urlError) {
  console.error(urlError);
  process.exit(1);
}

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
