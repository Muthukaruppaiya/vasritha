/**
 * Ensure local super admin exists with known password.
 * Usage: node --env-file=apps/web/.env.local scripts/seed-admin.mjs
 */
import { createRequire } from "node:module";
import pg from "pg";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");

const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/vasritha";

const ADMIN_EMAIL = "admin@vasritha.local";
const ADMIN_PASSWORD = "Admin@123";
const ADMIN_NAME = "Vasritha Admin";

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const existing = await client.query(`select id from users where email = $1`, [ADMIN_EMAIL]);
  let userId;

  if (existing.rowCount) {
    userId = existing.rows[0].id;
    await client.query(
      `update users set password_hash = $2, full_name = $3, updated_at = now() where id = $1`,
      [userId, passwordHash, ADMIN_NAME]
    );
    console.log("Updated password for existing admin.");
  } else {
    const created = await client.query(
      `insert into users (email, password_hash, full_name)
       values ($1, $2, $3)
       returning id`,
      [ADMIN_EMAIL, passwordHash, ADMIN_NAME]
    );
    userId = created.rows[0].id;
    console.log("Created admin user.");
  }

  await client.query(
    `insert into customers (id, full_name, email)
     values ($1, $2, $3)
     on conflict (id) do update set full_name = excluded.full_name, email = excluded.email`,
    [userId, ADMIN_NAME, ADMIN_EMAIL]
  );

  await client.query(
    `insert into user_roles (user_id, role_id)
     select $1, id from roles where code = 'super_admin'
     on conflict do nothing`,
    [userId]
  );

  console.log(`Admin ready: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
} catch (error) {
  console.error("Failed to seed admin:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
