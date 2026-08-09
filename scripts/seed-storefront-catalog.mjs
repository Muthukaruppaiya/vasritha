/**
 * Seed active catalog products + images + variants for the storefront.
 * Usage: node --env-file=apps/web/.env.local scripts/seed-storefront-catalog.mjs
 */
import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/vasritha";

const catalog = [
  {
    name: "Aarohi Kanchipuram Silk",
    shortName: "Aarohi Kanchipuram",
    slug: "aarohi-kanchipuram-silk",
    category: "sarees",
    color: "Crimson Red",
    price: 12950,
    compare: 14800,
    image: "/hero-silk.png",
    description: "A regal crimson silk saree with a luminous temple-border zari weave.",
    sizes: ["Free Size"]
  },
  {
    name: "Nandini Banarasi Weave",
    shortName: "Nandini Banarasi",
    slug: "nandini-banarasi-weave",
    category: "sarees",
    color: "Blush Pink",
    price: 10800,
    compare: 12500,
    image: "/catalog-synthetic-saree.png",
    description: "A classic Banarasi silhouette that makes celebration effortless.",
    sizes: ["Free Size"]
  },
  {
    name: "Meera Soft Silk",
    shortName: "Meera Soft",
    slug: "meera-soft-silk",
    category: "sarees",
    color: "Ivory Cream",
    price: 7450,
    compare: 8900,
    image: "/catalog-synthetic-saree.png",
    description: "Light, polished, and beautifully draped for all-day elegance.",
    sizes: ["Free Size"]
  },
  {
    name: "Sundari Cotton Weave",
    shortName: "Sundari Cotton",
    slug: "sundari-cotton-weave",
    category: "sarees",
    color: "Indigo Blue",
    price: 3250,
    compare: 3990,
    image: "/catalog-cotton-saree.png",
    description: "Breathable handwoven cotton with a quietly sophisticated border.",
    sizes: ["Free Size"]
  },
  {
    name: "Lakshmi Temple Bangles",
    shortName: "Lakshmi Bangles",
    slug: "lakshmi-temple-bangles",
    category: "jewelry",
    color: "Antique Gold",
    price: 2900,
    compare: 3450,
    image: "/catalog-bangles.png",
    description: "Antique-finish bangles with delicately sculpted temple motifs.",
    sizes: ["2.4", "2.6", "2.8", "2.10"]
  },
  {
    name: "Chandrika Earrings",
    shortName: "Chandrika Earrings",
    slug: "chandrika-earrings",
    category: "jewelry",
    color: "Gold",
    price: 1850,
    compare: 2250,
    image: "/catalog-earrings.png",
    description: "A bright, graceful pair to complete an occasion look.",
    sizes: ["One Size"]
  },
  {
    name: "Navratna Temple Necklace",
    shortName: "Navratna Necklace",
    slug: "navratna-temple-necklace",
    category: "jewelry",
    color: "Multicolour",
    price: 8750,
    compare: 9990,
    image: "/hero-jewelry.png",
    description: "A statement temple necklace finished with rich traditional details.",
    sizes: ["One Size"]
  },
  {
    name: "Hand-carved Lotus Panel",
    shortName: "Lotus Panel",
    slug: "hand-carved-lotus-panel",
    category: "handcrafted",
    color: "Natural Wood",
    price: 4600,
    compare: 5200,
    image: "/catalog-wooden-item.png",
    description: "A warm, hand-finished wooden panel celebrating the lotus.",
    sizes: ["One Size"]
  },
  {
    name: "Brass Ganesha Idol",
    shortName: "Brass Ganesha",
    slug: "brass-ganesha-idol",
    category: "handcrafted",
    color: "Antique Brass",
    price: 5400,
    compare: 6100,
    image: "/catalog-brass-idol.png",
    description: "A finely detailed brass idol for a cherished sacred corner.",
    sizes: ["One Size"]
  }
];

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("begin");

    for (const item of catalog) {
      const category = await client.query(`select id from categories where slug = $1`, [item.category]);
      if (!category.rows[0]) {
        console.warn(`Skipping ${item.slug}: category ${item.category} missing`);
        continue;
      }

      const existing = await client.query(`select id from products where slug = $1`, [item.slug]);
      let productId = existing.rows[0]?.id;

      if (productId) {
        await client.query(
          `update products
           set name = $2, short_name = $3, description = $4, color = $5, price = $6, compare_at_price = $7,
               status = 'active', stock_quantity = greatest(stock_quantity, 20),
               category_id = $8, updated_at = now()
           where id = $1`,
          [
            productId,
            item.name,
            item.shortName || "",
            item.description,
            item.color || "",
            item.price,
            item.compare,
            category.rows[0].id
          ]
        );
      } else {
        const inserted = await client.query(
          `insert into products
             (name, short_name, slug, category_id, description, color, price, compare_at_price, status, stock_quantity)
           values ($1, $2, $3, $4, $5, $6, $7, $8, 'active', 25)
           returning id`,
          [
            item.name,
            item.shortName || "",
            item.slug,
            category.rows[0].id,
            item.description,
            item.color || "",
            item.price,
            item.compare
          ]
        );
        productId = inserted.rows[0].id;
      }

      const imageExists = await client.query(
        `select id from product_images where product_id = $1 and storage_path = $2`,
        [productId, item.image]
      );
      if (!imageExists.rows[0]) {
        await client.query(
          `insert into product_images (product_id, storage_path, alt_text, sort_order)
           values ($1, $2, $3, 0)`,
          [productId, item.image, item.name]
        );
      }

      for (const size of item.sizes) {
        const sku = `${item.slug}-${size}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const variant = await client.query(
          `select id from product_variants where product_id = $1 and name = $2`,
          [productId, size]
        );
        if (variant.rows[0]) {
          await client.query(
            `update product_variants set price = $2, stock_quantity = greatest(stock_quantity, 10), sku = $3
             where id = $1`,
            [variant.rows[0].id, item.price, sku]
          );
        } else {
          await client.query(
            `insert into product_variants (product_id, name, sku, price, stock_quantity, attributes)
             values ($1, $2, $3, $4, 10, $5::jsonb)`,
            [productId, size, sku, item.price, JSON.stringify({ size })]
          );
        }
      }

      console.log(`Seeded product: ${item.slug}`);
    }

    await client.query("commit");
    console.log("Storefront catalog seed complete.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Failed to seed storefront catalog:", error.message);
  process.exit(1);
});
