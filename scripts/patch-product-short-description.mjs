/**
 * Add short_description on products.
 * Usage: node --env-file=apps/web/.env.local scripts/patch-product-short-description.mjs
 */
import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/vasritha";

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  try {
    await pool.query(`
      alter table public.products
        add column if not exists short_description text not null default ''
    `);
    console.log("Patched products.short_description");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
