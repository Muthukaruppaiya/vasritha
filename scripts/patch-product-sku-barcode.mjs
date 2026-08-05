/**
 * Add sku + barcode columns on products for admin product codes.
 * Usage: node --env-file=apps/web/.env.local scripts/patch-product-sku-barcode.mjs
 */
import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/vasritha";

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`
      alter table public.products
        add column if not exists sku text,
        add column if not exists barcode text
    `);
    await client.query(`
      create unique index if not exists products_sku_unique
        on public.products (sku) where sku is not null
    `);
    await client.query(`
      create unique index if not exists products_barcode_unique
        on public.products (barcode) where barcode is not null
    `);
    await client.query("commit");
    console.log("Patched products.sku and products.barcode");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
