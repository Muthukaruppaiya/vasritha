/**
 * Add color on products and backfill sample colours for existing catalogue.
 * Usage: node --env-file=apps/web/.env.local scripts/patch-product-color.mjs
 */
import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/vasritha";

const COLORS_BY_SLUG = {
  "aarohi-kanchipuram-silk": "Crimson Red",
  "nandini-banarasi-weave": "Blush Pink",
  "meera-soft-silk": "Ivory Cream",
  "sundari-cotton-weave": "Indigo Blue",
  "lakshmi-temple-bangles": "Antique Gold",
  "chandrika-earrings": "Gold",
  "navratna-temple-necklace": "Multicolour",
  "hand-carved-lotus-panel": "Natural Wood",
  "brass-ganesha-idol": "Antique Brass"
};

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query(`
      alter table public.products
        add column if not exists color text not null default ''
    `);

    for (const [slug, color] of Object.entries(COLORS_BY_SLUG)) {
      await client.query(
        `update products set color = $2 where slug = $1 and (color is null or color = '')`,
        [slug, color]
      );
    }

    console.log("Patched products.color");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
