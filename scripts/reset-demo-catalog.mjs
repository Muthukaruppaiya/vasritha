/**
 * Wipe product/test transactional data and seed 12–15 sellable demo products
 * with website + internal images, unique piece barcodes, synced stock,
 * plus basic shops and suppliers for POS / GRN testing.
 *
 * Usage: node --env-file=apps/web/.env.local scripts/reset-demo-catalog.mjs
 *    or: npm run db:reset:demo
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

const DEMO_SHOPS = [
  {
    code: "MAIN",
    name: "Vasritha — Tirupur Main",
    address: "12 Avinashi Road, Tirupur",
    phone: "9876543210",
    email: "main@vasritha.test",
    state: "Tamil Nadu",
    state_code: "33",
    gstin: "33AAAAA0000A1Z5",
    is_default: true
  },
  {
    code: "ANNUR",
    name: "Vasritha — Annur Branch",
    address: "45 Market Street, Annur",
    phone: "9876543211",
    email: "annur@vasritha.test",
    state: "Tamil Nadu",
    state_code: "33",
    gstin: null,
    is_default: false
  }
];

const DEMO_SUPPLIERS = [
  {
    code: "SUP-SILK",
    name: "Kanchi Silk Traders",
    trade_name: "Kanchi Silk",
    contact_person: "Ramesh Kumar",
    phone: "9840011122",
    email: "orders@kanchisilk.test",
    city: "Kanchipuram",
    state: "Tamil Nadu",
    state_code: "33",
    gstin: "33BBBKB0000B1Z9",
    payment_terms: "Net 30"
  },
  {
    code: "SUP-JEWEL",
    name: "Temple Craft Jewels",
    trade_name: "Temple Craft",
    contact_person: "Meena Devi",
    phone: "9840033344",
    email: "sales@templecraft.test",
    city: "Coimbatore",
    state: "Tamil Nadu",
    state_code: "33",
    gstin: "33CCCJC0000C1Z8",
    payment_terms: "Advance 50%"
  },
  {
    code: "SUP-WOOD",
    name: "Nilgiri Handcrafts",
    trade_name: "Nilgiri Crafts",
    contact_person: "Suresh Babu",
    phone: "9840055566",
    email: "hello@nilgiricrafts.test",
    city: "Coonoor",
    state: "Tamil Nadu",
    state_code: "33",
    gstin: null,
    payment_terms: "COD"
  }
];

const DEMO_CATEGORIES = [
  { slug: "sarees", name: "Sarees", sort: 1 },
  { slug: "jewelry", name: "Jewelry", sort: 2 },
  { slug: "churidhars-salwars", name: "Churidhars & Salwars", sort: 3 },
  { slug: "handcrafted", name: "Handcrafted", sort: 4 }
];

const WIPE_TABLES = [
  "return_items",
  "order_returns",
  "coupon_usage",
  "payments",
  "order_items",
  "orders",
  "cart_items",
  "carts",
  "wishlist_items",
  "wishlists",
  "inventory_grn_lines",
  "inventory_grns",
  "inventory_movements",
  "product_items",
  "product_price_history",
  "product_image_blobs",
  "product_images",
  "product_variants",
  "product_collections",
  "products",
  "reviews",
  "contact_messages",
  "audit_logs",
  "coupons",
  "section_items",
  "page_sections",
  "banners"
];

const catalog = [
  {
    name: "Aarohi Kanchipuram Silk",
    shortName: "Aarohi Kanchipuram",
    slug: "aarohi-kanchipuram-silk",
    category: "sarees",
    color: "Crimson Red",
    price: 12950,
    compare: 14800,
    hsn: "5007",
    gst: 5,
    stock: 6,
    website: "/hero-silk.png",
    internal: "/gallery/gallery-saree-crimson.png",
    description: "A regal crimson silk saree with a luminous temple-border zari weave.",
    size: "Free Size",
    label: "dress"
  },
  {
    name: "Nandini Banarasi Weave",
    shortName: "Nandini Banarasi",
    slug: "nandini-banarasi-weave",
    category: "sarees",
    color: "Blush Pink",
    price: 10800,
    compare: 12500,
    hsn: "5007",
    gst: 5,
    stock: 5,
    website: "/catalog-synthetic-saree.png",
    internal: "/gallery/gallery-saree-banarasi.png",
    description: "A classic Banarasi silhouette that makes celebration effortless.",
    size: "Free Size",
    label: "dress"
  },
  {
    name: "Meera Soft Silk",
    shortName: "Meera Soft",
    slug: "meera-soft-silk",
    category: "sarees",
    color: "Ivory Cream",
    price: 7450,
    compare: 8900,
    hsn: "5007",
    gst: 5,
    stock: 8,
    website: "/catalog-synthetic-saree.png",
    internal: "/gallery/gallery-saree-soft.png",
    description: "Light, polished, and beautifully draped for all-day elegance.",
    size: "Free Size",
    label: "dress"
  },
  {
    name: "Sundari Cotton Weave",
    shortName: "Sundari Cotton",
    slug: "sundari-cotton-weave",
    category: "sarees",
    color: "Indigo Blue",
    price: 3250,
    compare: 3990,
    hsn: "5208",
    gst: 5,
    stock: 10,
    website: "/catalog-cotton-saree.png",
    internal: "/gallery/gallery-cotton-saree.png",
    description: "Breathable handwoven cotton with a quietly sophisticated border.",
    size: "Free Size",
    label: "dress"
  },
  {
    name: "Lakshmi Temple Bangles",
    shortName: "Lakshmi Bangles",
    slug: "lakshmi-temple-bangles",
    category: "jewelry",
    color: "Antique Gold",
    price: 2900,
    compare: 3450,
    hsn: "7117",
    gst: 5,
    stock: 12,
    website: "/catalog-bangles.png",
    internal: "/gallery/gallery-bangles.png",
    description: "Antique-finish bangles with delicately sculpted temple motifs.",
    size: "2.8",
    label: "accessory"
  },
  {
    name: "Chandrika Earrings",
    shortName: "Chandrika Earrings",
    slug: "chandrika-earrings",
    category: "jewelry",
    color: "Gold",
    price: 1850,
    compare: 2250,
    hsn: "7117",
    gst: 5,
    stock: 15,
    website: "/catalog-earrings.png",
    internal: "/gallery/gallery-earrings.png",
    description: "A bright, graceful pair to complete an occasion look.",
    size: "One Size",
    label: "accessory"
  },
  {
    name: "Navratna Temple Necklace",
    shortName: "Navratna Necklace",
    slug: "navratna-temple-necklace",
    category: "jewelry",
    color: "Multicolour",
    price: 8750,
    compare: 9990,
    hsn: "7117",
    gst: 5,
    stock: 4,
    website: "/hero-jewelry.png",
    internal: "/gallery/gallery-necklace.png",
    description: "A statement temple necklace finished with rich traditional details.",
    size: "One Size",
    label: "accessory"
  },
  {
    name: "Hand-carved Lotus Panel",
    shortName: "Lotus Panel",
    slug: "hand-carved-lotus-panel",
    category: "handcrafted",
    color: "Natural Wood",
    price: 4600,
    compare: 5200,
    hsn: "4420",
    gst: 18,
    stock: 7,
    website: "/catalog-wooden-item.png",
    internal: "/gallery/gallery-lotus-panel.png",
    description: "A warm, hand-finished wooden panel celebrating the lotus.",
    size: "One Size",
    label: "accessory"
  },
  {
    name: "Brass Ganesha Idol",
    shortName: "Brass Ganesha",
    slug: "brass-ganesha-idol",
    category: "handcrafted",
    color: "Antique Brass",
    price: 5400,
    compare: 6100,
    hsn: "8306",
    gst: 18,
    stock: 5,
    website: "/catalog-brass-idol.png",
    internal: "/gallery/gallery-ganesha.png",
    description: "A finely detailed brass idol for a cherished sacred corner.",
    size: "One Size",
    label: "accessory"
  },
  {
    name: "Maya Soft Salwar Set",
    shortName: "Maya Salwar",
    slug: "maya-soft-salwar-set",
    category: "churidhars-salwars",
    color: "Mint Green",
    price: 2890,
    compare: 3490,
    hsn: "6204",
    gst: 5,
    stock: 9,
    website: "/hero-salwar.png",
    internal: "/gallery/gallery-saree-soft.png",
    description: "Everyday soft salwar set with a clean, flattering drape.",
    size: "M",
    label: "dress"
  },
  {
    name: "Anika Festive Salwar",
    shortName: "Anika Salwar",
    slug: "anika-festive-salwar",
    category: "churidhars-salwars",
    color: "Maroon",
    price: 4190,
    compare: 4990,
    hsn: "6204",
    gst: 5,
    stock: 6,
    website: "/hero-salwar.png",
    internal: "/catalog-synthetic-saree.png",
    description: "Festive salwar set with subtle shimmer for celebrations.",
    size: "L",
    label: "dress"
  },
  {
    name: "Temple Coin Necklace",
    shortName: "Temple Coin",
    slug: "temple-coin-necklace",
    category: "jewelry",
    color: "Antique Gold",
    price: 6200,
    compare: 7200,
    hsn: "7117",
    gst: 5,
    stock: 5,
    website: "/hero-jewelry.png",
    internal: "/gallery/gallery-necklace.png",
    description: "Layered coin necklace with a traditional temple finish.",
    size: "One Size",
    label: "accessory"
  },
  {
    name: "Peacock Wood Frame",
    shortName: "Peacock Frame",
    slug: "peacock-wood-frame",
    category: "handcrafted",
    color: "Teak",
    price: 3850,
    compare: 4500,
    hsn: "4420",
    gst: 18,
    stock: 8,
    website: "/catalog-wooden-item.png",
    internal: "/gallery/gallery-lotus-panel.png",
    description: "Hand-carved peacock motif frame for a warm home accent.",
    size: "One Size",
    label: "accessory"
  },
  {
    name: "Rukmini Soft Silk",
    shortName: "Rukmini Soft",
    slug: "rukmini-soft-silk",
    category: "sarees",
    color: "Emerald",
    price: 8990,
    compare: 10490,
    hsn: "5007",
    gst: 5,
    stock: 7,
    website: "/hero-silk.png",
    internal: "/gallery/gallery-saree-crimson.png",
    description: "Rich emerald soft silk with a refined contrast border.",
    size: "Free Size",
    label: "dress"
  }
];

function skuFromSlug(slug, index) {
  const code = slug
    .replace(/[^a-z0-9]+/gi, "")
    .slice(0, 6)
    .toUpperCase();
  return `VAS-${code}${String(index + 1).padStart(2, "0")}`;
}

function barcodeFromSku(sku) {
  return sku.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16);
}

function ensureLocalCopy(productId, sourcePublicPath, kind, index) {
  const sourceAbs = path.join(publicDir, sourcePublicPath.replace(/^\//, ""));
  if (!fs.existsSync(sourceAbs)) {
    throw new Error(`Missing source image: ${sourcePublicPath}`);
  }
  const ext = path.extname(sourceAbs) || ".png";
  const dir = path.join(publicDir, "uploads", "products", productId);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${kind}-${index + 1}${ext}`;
  const destAbs = path.join(dir, filename);
  fs.copyFileSync(sourceAbs, destAbs);
  return `/uploads/products/${productId}/${filename}`;
}

async function tableExists(client, name) {
  const { rows } = await client.query(
    `select 1 from information_schema.tables
     where table_schema = 'public' and table_name = $1`,
    [name]
  );
  return rows.length > 0;
}

async function columnExists(client, table, column) {
  const { rows } = await client.query(
    `select 1 from information_schema.columns
     where table_schema = 'public' and table_name = $1 and column_name = $2`,
    [table, column]
  );
  return rows.length > 0;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("begin");

    const before = await client.query(`
      select
        (select count(*)::int from products) as products,
        (select count(*)::int from product_items) as items,
        (select count(*)::int from orders) as orders
    `);
    console.log("Before:", before.rows[0]);

    for (const table of WIPE_TABLES) {
      if (!(await tableExists(client, table))) {
        console.log(`skip missing: ${table}`);
        continue;
      }
      await client.query(`truncate table public.${table} restart identity cascade`);
      console.log(`cleared: ${table}`);
    }

    // Categories (required for products)
    for (const cat of DEMO_CATEGORIES) {
      await client.query(
        `insert into categories (slug, name, sort_order)
         values ($1, $2, $3)
         on conflict (slug) do update
         set name = excluded.name, sort_order = excluded.sort_order`,
        [cat.slug, cat.name, cat.sort]
      );
    }
    console.log(`categories ready: ${DEMO_CATEGORIES.map((c) => c.slug).join(", ")}`);

    // Shops
    if (await tableExists(client, "shops")) {
      for (const shop of DEMO_SHOPS) {
        await client.query(
          `insert into shops (
             code, name, address, phone, email, state, state_code, gstin, is_active, is_default
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)
           on conflict ((lower(code))) do update set
             name = excluded.name,
             address = excluded.address,
             phone = excluded.phone,
             email = excluded.email,
             state = excluded.state,
             state_code = excluded.state_code,
             gstin = excluded.gstin,
             is_active = true,
             is_default = excluded.is_default,
             updated_at = now()`,
          [
            shop.code,
            shop.name,
            shop.address,
            shop.phone,
            shop.email,
            shop.state,
            shop.state_code,
            shop.gstin,
            shop.is_default
          ]
        );
      }
      // Ensure only one default
      await client.query(`update shops set is_default = false where code <> 'MAIN'`);
      await client.query(`update shops set is_default = true where code = 'MAIN'`);
      console.log(`shops seeded: ${DEMO_SHOPS.map((s) => s.code).join(", ")}`);
    } else {
      console.log("skip shops: table missing");
    }

    // Suppliers
    if (await tableExists(client, "suppliers")) {
      for (const supplier of DEMO_SUPPLIERS) {
        await client.query(
          `insert into suppliers (
             code, name, trade_name, contact_person, phone, email,
             city, state, state_code, gstin, payment_terms, is_active
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
           on conflict ((lower(code))) do update set
             name = excluded.name,
             trade_name = excluded.trade_name,
             contact_person = excluded.contact_person,
             phone = excluded.phone,
             email = excluded.email,
             city = excluded.city,
             state = excluded.state,
             state_code = excluded.state_code,
             gstin = excluded.gstin,
             payment_terms = excluded.payment_terms,
             is_active = true,
             updated_at = now()`,
          [
            supplier.code,
            supplier.name,
            supplier.trade_name,
            supplier.contact_person,
            supplier.phone,
            supplier.email,
            supplier.city,
            supplier.state,
            supplier.state_code,
            supplier.gstin,
            supplier.payment_terms
          ]
        );
      }
      console.log(`suppliers seeded: ${DEMO_SUPPLIERS.map((s) => s.code).join(", ")}`);
    } else {
      console.log("skip suppliers: table missing");
    }

    const defaultShop = (await tableExists(client, "shops"))
      ? await client.query(`select id from shops where is_default = true limit 1`)
      : { rows: [] };
    const defaultShopId = defaultShop.rows[0]?.id || null;
    const hasItemShop = await columnExists(client, "product_items", "shop_id");

    const hasImageKind = await columnExists(client, "product_images", "image_kind");
    const hasHsn = await columnExists(client, "products", "hsn_code");
    const hasGst = await columnExists(client, "products", "gst_rate");
    const hasTag = await columnExists(client, "products", "tag");
    const hasSkuPrefix = await columnExists(client, "products", "sku_prefix");
    const hasLabel = await columnExists(client, "products", "label_size");
    const hasShortName = await columnExists(client, "products", "short_name");
    const hasBarcode = await columnExists(client, "products", "barcode");

    for (let i = 0; i < catalog.length; i += 1) {
      const item = catalog[i];
      const category = await client.query(`select id from categories where slug = $1`, [
        item.category
      ]);
      if (!category.rows[0]) {
        console.warn(`Skipping ${item.slug}: category ${item.category} missing`);
        continue;
      }

      const sku = skuFromSlug(item.slug, i);
      const barcode = barcodeFromSku(sku);
      const tag = sku;

      const cols = [
        "name",
        "slug",
        "category_id",
        "description",
        "color",
        "price",
        "compare_at_price",
        "status",
        "stock_quantity",
        "sku",
        "is_featured"
      ];
      const vals = [
        item.name,
        item.slug,
        category.rows[0].id,
        item.description,
        item.color,
        item.price,
        item.compare,
        "active",
        item.stock,
        sku,
        i < 4
      ];

      if (hasShortName) {
        cols.push("short_name");
        vals.push(item.shortName);
      }
      if (hasBarcode) {
        cols.push("barcode");
        vals.push(barcode);
      }
      if (hasTag) {
        cols.push("tag");
        vals.push(tag);
      }
      if (hasSkuPrefix) {
        cols.push("sku_prefix");
        vals.push("VAS");
      }
      if (hasLabel) {
        cols.push("label_size");
        vals.push(item.label);
      }
      if (hasHsn) {
        cols.push("hsn_code");
        vals.push(item.hsn);
      }
      if (hasGst) {
        cols.push("gst_rate");
        vals.push(item.gst);
      }

      const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(", ");
      const inserted = await client.query(
        `insert into products (${cols.join(", ")}) values (${placeholders}) returning id`,
        vals
      );
      const productId = inserted.rows[0].id;

      const websitePath = ensureLocalCopy(productId, item.website, "website", 0);
      const internalPath = ensureLocalCopy(productId, item.internal, "internal", 0);

      if (hasImageKind) {
        await client.query(
          `insert into product_images (product_id, storage_path, alt_text, sort_order, image_kind)
           values ($1, $2, $3, 0, 'website'), ($1, $4, $5, 0, 'internal')`,
          [productId, websitePath, item.name, internalPath, `${item.name} (internal)`]
        );
      } else {
        await client.query(
          `insert into product_images (product_id, storage_path, alt_text, sort_order)
           values ($1, $2, $3, 0), ($1, $4, $5, 1)`,
          [productId, websitePath, item.name, internalPath, `${item.name} (internal)`]
        );
      }

      const variantSku = `${sku}-${item.size}`.toUpperCase().replace(/[^A-Z0-9-]/g, "-");
      const variant = await client.query(
        `insert into product_variants (product_id, name, sku, price, stock_quantity, attributes)
         values ($1, $2, $3, $4, 0, $5::jsonb)
         returning id`,
        [productId, item.size, variantSku, item.price, JSON.stringify({ size: item.size })]
      );
      const variantId = variant.rows[0].id;

      const compact = barcodeFromSku(sku);
      for (let seq = 1; seq <= item.stock; seq += 1) {
        const padded = String(seq).padStart(4, "0");
        const unitCode = `${sku}-${padded}`.toUpperCase();
        const unitBarcode = `${compact}${padded}`;
        if (hasItemShop && defaultShopId) {
          await client.query(
            `insert into product_items
               (product_id, variant_id, tag, seq, unit_code, barcode, status, shop_id)
             values ($1, $2, $3, $4, $5, $6, 'to_sell', $7)`,
            [productId, variantId, tag, seq, unitCode, unitBarcode, defaultShopId]
          );
        } else {
          await client.query(
            `insert into product_items
               (product_id, variant_id, tag, seq, unit_code, barcode, status)
             values ($1, $2, $3, $4, $5, $6, 'to_sell')`,
            [productId, variantId, tag, seq, unitCode, unitBarcode]
          );
        }
      }

      await client.query(
        `update product_variants
         set stock_quantity = (
           select count(*)::int from product_items
           where variant_id = $1 and status = 'to_sell'
         )
         where id = $1`,
        [variantId]
      );
      await client.query(
        `update products p
         set stock_quantity = coalesce((
           select sum(pv.stock_quantity)::int from product_variants pv where pv.product_id = p.id
         ), 0),
         updated_at = now()
         where p.id = $1`,
        [productId]
      );

      console.log(`seeded ${item.slug} · ${sku} · stock ${item.stock}`);
    }

    await client.query("commit");

    const after = await client.query(`
      select
        (select count(*)::int from products) as products,
        (select count(*)::int from product_variants) as variants,
        (select count(*)::int from product_items where status = 'to_sell') as sellable_items,
        (select count(*)::int from product_images) as images,
        (select count(*)::int from products where stock_quantity > 0) as in_stock_products,
        (select count(*)::int from shops) as shops,
        (select count(*)::int from suppliers) as suppliers
    `);
    console.log("After:", after.rows[0]);

    const check = await client.query(`
      select p.name, p.sku, p.stock_quantity as catalogue,
             pv.stock_quantity as inventory,
             (select count(*)::int from product_items i
              where i.variant_id = pv.id and i.status = 'to_sell') as units
      from products p
      join product_variants pv on pv.product_id = p.id
      order by p.name
    `);
    const mismatch = check.rows.filter(
      (r) => Number(r.catalogue) !== Number(r.inventory) || Number(r.inventory) !== Number(r.units)
    );
    if (mismatch.length) {
      console.warn("Stock mismatches:", mismatch);
    } else {
      console.log("Stock check OK — catalogue = inventory = unique pieces for all products.");
    }
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
