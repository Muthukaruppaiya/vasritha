/**
 * Wipe transactional / secondary data while keeping users + products.
 * Keeps: users, user_roles, roles, products, product_images, product_variants,
 *        categories, subcategories (required by products).
 *
 * Usage: node --env-file=apps/web/.env.local scripts/clean-db-keep-users-products.mjs
 */
import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/vasritha";

/** Tables wiped for a fresh operational state (order matters less with CASCADE). */
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
  "addresses",
  "inventory_movements",
  "reviews",
  "contact_messages",
  "audit_logs",
  "coupons",
  "product_collections",
  "section_items",
  "page_sections",
  "banners",
  "menu_items",
  "customers"
];

async function tableExists(client, name) {
  const { rows } = await client.query(
    `select 1 from information_schema.tables
     where table_schema = 'public' and table_name = $1`,
    [name]
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
        (select count(*)::int from users) as users,
        (select count(*)::int from products) as products,
        (select count(*)::int from orders) as orders,
        (select count(*)::int from carts) as carts,
        (select count(*)::int from customers) as customers
    `);
    console.log("Before:", before.rows[0]);

    for (const table of WIPE_TABLES) {
      if (!(await tableExists(client, table))) {
        console.log(`skip missing table: ${table}`);
        continue;
      }
      await client.query(`truncate table public.${table} restart identity cascade`);
      console.log(`cleared: ${table}`);
    }

    // Recreate thin customer profiles for remaining users (needed for storefront/admin links).
    await client.query(`
      insert into customers (id, full_name, email, phone)
      select u.id, u.full_name, u.email, u.phone
      from users u
      on conflict (id) do nothing
    `);

    // Ensure system menus / payment methods / site settings still exist (idempotent seeds).
    await client.query(`
      insert into payment_methods (name, code, provider, is_online, sort_order) values
        ('UPI', 'upi', 'razorpay', true, 1),
        ('Card', 'card', 'razorpay', true, 2),
        ('Netbanking', 'netbanking', 'razorpay', true, 3),
        ('Cash', 'cash', 'manual', false, 4)
      on conflict (code) do nothing
    `);

    await client.query(`
      insert into menus (code, name) values
        ('main_nav', 'Main Navigation'),
        ('mobile_drawer', 'Mobile Drawer'),
        ('footer_shop', 'Footer Shop'),
        ('footer_legal', 'Footer Legal')
      on conflict (code) do nothing
    `);

    await client.query(`
      insert into site_settings (site_name, tagline, support_email, whatsapp_number, free_shipping_min)
      select 'Vasritha', 'Timeless Elegance', 'hello@vasritha.com', '919000000000', 2500
      where not exists (select 1 from site_settings)
    `);

    await client.query(`
      insert into website_pages (slug, title, body, is_published) values
        ('about', 'About Vasritha', 'About content', true),
        ('contact', 'Contact', 'Contact content', true),
        ('privacy', 'Privacy Policy', 'Privacy content', false),
        ('terms', 'Terms of Service', 'Terms content', false)
      on conflict (slug) do nothing
    `);

    await client.query("commit");

    const after = await client.query(`
      select
        (select count(*)::int from users) as users,
        (select count(*)::int from products) as products,
        (select count(*)::int from product_images) as product_images,
        (select count(*)::int from product_variants) as product_variants,
        (select count(*)::int from orders) as orders,
        (select count(*)::int from carts) as carts,
        (select count(*)::int from customers) as customers,
        (select count(*)::int from coupons) as coupons,
        (select count(*)::int from audit_logs) as audit_logs,
        (select count(*)::int from inventory_movements) as inventory_movements
    `);
    console.log("After:", after.rows[0]);
    console.log("Done — kept users + products; cleared transactional / secondary data.");
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
