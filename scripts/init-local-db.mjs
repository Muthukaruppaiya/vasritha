/**
 * Apply local PostgreSQL schema and seed a default super admin.
 * Usage: npm run db:init
 * Requires DATABASE_URL (or defaults to postgresql://postgres:postgres@127.0.0.1:5433/vasritha)
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import pg from "pg";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const schemaPath = path.join(root, "db", "local", "schema.sql");
const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5433/vasritha";

const ADMIN_EMAIL = "admin@vasritha.local";
const ADMIN_PASSWORD = "Admin@123";
const ADMIN_NAME = "Vasritha Admin";

const sql = fs.readFileSync(schemaPath, "utf8");
const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query(sql);
  console.log("Local PostgreSQL schema applied successfully.");

  const optimizePath = path.join(root, "db", "local", "optimize_v1.sql");
  if (fs.existsSync(optimizePath)) {
    await client.query(fs.readFileSync(optimizePath, "utf8"));
    console.log("DB optimize v1 applied.");
  }

  const existing = await client.query(`select id from users where email = $1`, [ADMIN_EMAIL]);
  if (!existing.rowCount) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await client.query(
      `insert into users (email, password_hash, full_name)
       values ($1, $2, $3)
       returning id`,
      [ADMIN_EMAIL, passwordHash, ADMIN_NAME]
    );
    const userId = user.rows[0].id;
    await client.query(
      `insert into customers (id, full_name, email)
       values ($1, $2, $3)
       on conflict (id) do nothing`,
      [userId, ADMIN_NAME, ADMIN_EMAIL]
    );
    await client.query(
      `insert into user_roles (user_id, role_id)
       select $1, id from roles where code = 'super_admin'
       on conflict do nothing`,
      [userId]
    );
    console.log(`Seeded super admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    console.log(`Super admin already exists: ${ADMIN_EMAIL}`);
  }

  console.log("Database:", databaseUrl.replace(/:[^:@/]+@/, ":****@"));
} catch (error) {
  console.error("Failed to apply schema:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
