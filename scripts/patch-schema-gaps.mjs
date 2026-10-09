/**
 * One-shot local schema repair for missing columns that older DBs lack.
 * Safe to re-run. Usage: npm run db:patch:schema-gaps
 */
import pg from "pg";

const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/vasritha";

const statements = [
  `alter table public.site_settings
     add column if not exists company_legal_name text,
     add column if not exists company_address text,
     add column if not exists company_gstin text,
     add column if not exists company_state text,
     add column if not exists company_state_code text,
     add column if not exists prices_inclusive_of_gst boolean not null default true,
     add column if not exists support_phone text,
     add column if not exists support_email text`,
  `update public.site_settings
     set company_legal_name = coalesce(nullif(trim(company_legal_name), ''), nullif(trim(site_name), ''), 'Vasritha')
     where company_legal_name is null or btrim(company_legal_name) = ''`,
  `alter table public.orders
     add column if not exists shop_id uuid references public.shops(id)`,
  `alter table public.inventory_movements
     add column if not exists shop_id uuid references public.shops(id)`,
  `alter table public.product_items
     add column if not exists shop_id uuid references public.shops(id)`,
  `alter table public.inventory_grns
     add column if not exists shop_id uuid references public.shops(id)`,
  `alter table public.inventory_grns
     add column if not exists invoice_date date,
     add column if not exists document_path text,
     add column if not exists discount_amount numeric(12,2) not null default 0,
     add column if not exists tax_amount numeric(12,2) not null default 0`,
  `alter table public.users
     add column if not exists shop_id uuid references public.shops(id)`,
  `alter table public.products
     add column if not exists hsn_code text,
     add column if not exists gst_rate numeric(5,2) not null default 5`,
  `alter table public.order_items
     add column if not exists hsn_code text,
     add column if not exists gst_rate numeric(5,2)`,
  `create table if not exists public.shop_variant_stock (
     shop_id uuid not null references public.shops(id) on delete cascade,
     variant_id uuid not null references public.product_variants(id) on delete cascade,
     stock_quantity integer not null default 0,
     updated_at timestamptz not null default now(),
     primary key (shop_id, variant_id),
     constraint shop_variant_stock_qty_nonneg check (stock_quantity >= 0)
   )`,
  `update public.product_items pi
     set shop_id = d.id
     from public.shops d
     where d.is_default and pi.shop_id is null`,
  `update public.inventory_movements m
     set shop_id = d.id
     from public.shops d
     where d.is_default and m.shop_id is null`,
  `update public.inventory_grns g
     set shop_id = d.id
     from public.shops d
     where d.is_default and g.shop_id is null`,
  `insert into public.shop_variant_stock (shop_id, variant_id, stock_quantity, updated_at)
     select pi.shop_id, pi.variant_id, count(*)::int, now()
     from public.product_items pi
     where pi.status = 'to_sell' and pi.shop_id is not null
     group by pi.shop_id, pi.variant_id
     on conflict (shop_id, variant_id) do update
     set stock_quantity = excluded.stock_quantity, updated_at = now()`
];

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  for (const sql of statements) {
    try {
      await client.query(sql);
      console.log("ok:", sql.slice(0, 72).replace(/\s+/g, " ") + "…");
    } catch (error) {
      console.warn("skip:", error instanceof Error ? error.message : error);
    }
  }
  console.log("Schema gap patch complete.");
} catch (error) {
  console.error("Failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
