/**
 * Patch roles table for custom role creation.
 * Usage: node --env-file=apps/web/.env.local scripts/patch-roles-text.mjs
 */
import pg from "pg";

const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/vasritha";

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();

  const col = await client.query(
    `select udt_name
     from information_schema.columns
     where table_schema = 'public' and table_name = 'roles' and column_name = 'code'`
  );

  if (col.rows[0]?.udt_name === "app_role") {
    await client.query(`alter table public.roles alter column code type text using code::text`);
    console.log("Converted roles.code from enum to text.");
  } else {
    console.log("roles.code already text (or missing).");
  }

  await client.query(`alter table public.roles add column if not exists permission_template text`);
  await client.query(
    `alter table public.roles add column if not exists is_system boolean not null default false`
  );

  await client.query(`
    update public.roles
    set is_system = true,
        permission_template = coalesce(permission_template, code)
    where code in (
      'super_admin',
      'business_owner',
      'manager',
      'billing_staff',
      'inventory_staff',
      'packing_shipping_staff',
      'customer_support_staff',
      'accountant',
      'customer'
    )
  `);

  console.log("Roles patch applied.");
} catch (error) {
  console.error("Patch failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
