/**
 * Ensure every product has at least 3 gallery images.
 * Usage: node --env-file=apps/web/.env.local scripts/seed-product-images.mjs
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "apps/web/public");

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/vasritha";

const IMAGE_SETS = {
  "aarohi-kanchipuram-silk": [
    "/gallery/gallery-saree-crimson.png",
    "/hero-silk.png",
    "/gallery/gallery-saree-soft.png"
  ],
  "nandini-banarasi-weave": [
    "/gallery/gallery-saree-banarasi.png",
    "/catalog-synthetic-saree.png",
    "/gallery/gallery-saree-crimson.png"
  ],
  "meera-soft-silk": [
    "/gallery/gallery-saree-soft.png",
    "/catalog-synthetic-saree.png",
    "/hero-salwar.png"
  ],
  "sundari-cotton-weave": [
    "/gallery/gallery-cotton-saree.png",
    "/catalog-cotton-saree.png",
    "/gallery/gallery-saree-soft.png"
  ],
  "lakshmi-temple-bangles": [
    "/gallery/gallery-bangles.png",
    "/catalog-bangles.png",
    "/hero-jewelry.png"
  ],
  "chandrika-earrings": [
    "/gallery/gallery-earrings.png",
    "/catalog-earrings.png",
    "/hero-jewelry.png"
  ],
  "navratna-temple-necklace": [
    "/gallery/gallery-necklace.png",
    "/hero-jewelry.png",
    "/gallery/gallery-earrings.png"
  ],
  "hand-carved-lotus-panel": [
    "/gallery/gallery-lotus-panel.png",
    "/catalog-wooden-item.png",
    "/boutique-pattern.png"
  ],
  "brass-ganesha-idol": [
    "/gallery/gallery-ganesha.png",
    "/catalog-brass-idol.png",
    "/gallery/gallery-lotus-panel.png"
  ]
};

function ensureLocalCopy(productId, sourcePublicPath, index) {
  const sourceAbs = path.join(publicDir, sourcePublicPath.replace(/^\//, ""));
  if (!fs.existsSync(sourceAbs)) {
    throw new Error(`Missing source image: ${sourcePublicPath}`);
  }

  const ext = path.extname(sourceAbs) || ".png";
  const dir = path.join(publicDir, "uploads", "products", productId);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `gallery-${index + 1}${ext}`;
  const destAbs = path.join(dir, filename);
  fs.copyFileSync(sourceAbs, destAbs);
  return `/uploads/products/${productId}/${filename}`;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("begin");
    const { rows: products } = await client.query(`select id, name, slug from products order by name`);

    for (const product of products) {
      const set = IMAGE_SETS[product.slug];
      if (!set || set.length < 3) {
        console.warn(`No 3-image set for ${product.slug}, skipping`);
        continue;
      }

      await client.query(`delete from product_images where product_id = $1`, [product.id]);

      for (let i = 0; i < 3; i += 1) {
        const storagePath = ensureLocalCopy(product.id, set[i], i);
        await client.query(
          `insert into product_images (product_id, storage_path, alt_text, sort_order)
           values ($1, $2, $3, $4)`,
          [product.id, storagePath, `${product.name} image ${i + 1}`, i]
        );
      }

      console.log(`Attached 3 images → ${product.slug}`);
    }

    await client.query("commit");
    console.log("Product image seed complete (min 3 per product).");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Failed:", error.message);
  process.exit(1);
});
