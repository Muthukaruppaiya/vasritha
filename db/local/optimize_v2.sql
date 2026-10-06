-- =============================================================================
-- Vasritha DBA schema optimize v2
-- Purpose: make the live schema complete, constrained, and self-documenting.
-- Safe to re-run (IF NOT EXISTS / exception guards).
-- Apply after optimize_v1: npm run db:optimize
-- =============================================================================
--
-- STOCK MODEL (why three levels exist)
-- 1) product_items     = unique physical pieces (hang-tag barcodes). Source of
--                        truth for unique-item retail when the units model is used.
-- 2) product_variants  = sellable SKU aggregate (size/colour). Used by cart/POS.
-- 3) products.stock_*  = denormalized rollup for fast catalog lists.
--
-- PURCHASE MODEL
-- suppliers + inventory_grns + inventory_grn_lines = inbound stock with approval.
-- Stock is applied only on GRN approve (not on draft submit).
-- =============================================================================

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1) Categories: publish + optional category shipping rates
-- -----------------------------------------------------------------------------
alter table public.categories
  add column if not exists is_published boolean not null default true,
  add column if not exists shipping_charge numeric(12,2) not null default 0,
  add column if not exists shipping_is_free boolean not null default false,
  add column if not exists shipping_rate_active boolean not null default false,
  add column if not exists image_path text,
  add column if not exists name_i18n jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.categories
    add constraint categories_shipping_charge_chk check (shipping_charge >= 0);
exception when duplicate_object then null; end $$;

create index if not exists categories_published_sort_idx
  on public.categories (is_published, sort_order)
  where is_published = true;

comment on column public.categories.is_published is
  'Storefront visibility. Unpublished categories stay available in admin.';
comment on column public.categories.shipping_charge is
  'Optional category freight when shipping_rate_active=true.';
comment on column public.categories.name_i18n is
  'Optional locale labels (en/ta/ml/…). Empty locales fall back to name.';

-- -----------------------------------------------------------------------------
-- 2) Brands + shops
-- -----------------------------------------------------------------------------
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  slug text not null,
  tagline text,
  logo_path text,
  support_email text,
  support_phone text,
  website_url text,
  is_active boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_code_nonempty check (length(trim(code)) > 0),
  constraint brands_name_nonempty check (length(trim(name)) > 0),
  constraint brands_slug_nonempty check (length(trim(slug)) > 0)
);

create unique index if not exists brands_code_unique_idx on public.brands (lower(code));
create unique index if not exists brands_slug_unique_idx on public.brands (lower(slug));
create unique index if not exists brands_one_default_idx on public.brands ((1)) where is_default;
create index if not exists brands_active_idx on public.brands (is_active, sort_order, name);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  address text,
  phone text,
  email text,
  state text,
  state_code text,
  gstin text,
  brand_id uuid references public.brands(id),
  is_active boolean not null default true,
  is_default boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shops_code_nonempty check (length(trim(code)) > 0),
  constraint shops_name_nonempty check (length(trim(name)) > 0)
);

create unique index if not exists shops_code_unique_idx on public.shops (lower(code));
create unique index if not exists shops_one_default_idx on public.shops ((1)) where is_default;

comment on table public.brands is 'Sales brand plugins (e.g. Vasritha under Sukadhaa ops).';
comment on table public.shops is 'Physical store locations for POS / GST / returns.';

-- -----------------------------------------------------------------------------
-- 3) Products: catalog + tax + restock + parent/child designs
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.product_label_size as enum ('accessory', 'dress');
exception when duplicate_object then null; end $$;

alter table public.products
  add column if not exists brand_id uuid,
  add column if not exists parent_product_id uuid,
  add column if not exists sku text,
  add column if not exists barcode text,
  add column if not exists tag text,
  add column if not exists sku_prefix text not null default 'VAS',
  add column if not exists short_name text not null default '',
  add column if not exists short_description text not null default '',
  add column if not exists color text not null default '',
  add column if not exists hsn_code text,
  add column if not exists gst_rate numeric(5,2) not null default 5,
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_order integer not null default 0,
  add column if not exists label_size public.product_label_size not null default 'dress',
  add column if not exists image_upload_token uuid not null default gen_random_uuid(),
  add column if not exists restock_expected boolean not null default false;

do $$ begin
  alter table public.products
    add constraint products_brand_id_fkey
    foreign key (brand_id) references public.brands(id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.products
    add constraint products_parent_product_id_fkey
    foreign key (parent_product_id) references public.products(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.products
    add constraint products_parent_not_self
    check (parent_product_id is null or parent_product_id <> id);
exception when duplicate_object then null; end $$;

-- Keep catalogue GST in sync with app ALLOWED_GST_RATES (incl. standard 12%).
update public.products
set gst_rate = 5
where gst_rate is null
   or gst_rate not in (0, 3, 5, 9, 12, 18);

alter table public.products
  drop constraint if exists products_gst_rate_chk;

do $$ begin
  alter table public.products
    add constraint products_gst_rate_chk
    check (gst_rate in (0, 3, 5, 9, 12, 18));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.products
    add constraint products_hsn_chk
    check (hsn_code is null or hsn_code ~ '^[0-9]{4,8}$');
exception when duplicate_object then null; end $$;

create unique index if not exists products_sku_unique_idx
  on public.products (sku) where sku is not null;
create unique index if not exists products_barcode_unique_idx
  on public.products (barcode) where barcode is not null;
create unique index if not exists products_image_upload_token_idx
  on public.products (image_upload_token);
create index if not exists products_parent_product_id_idx
  on public.products (parent_product_id) where parent_product_id is not null;
create index if not exists products_brand_id_idx
  on public.products (brand_id) where brand_id is not null;
create index if not exists products_restock_expected_idx
  on public.products (restock_expected) where restock_expected = true;

comment on column public.products.stock_quantity is
  'Denormalized SUM(product_variants.stock_quantity). Maintained by trigger.';
comment on column public.products.restock_expected is
  'When true and stock=0, keep product visible as Coming soon on storefront.';
comment on column public.products.parent_product_id is
  'Optional design parent (Case 2 jewelry groups). Null = standalone product.';
comment on column public.products.tag is
  'Family tag connecting unique piece barcodes (product_items).';
comment on column public.products.gst_rate is
  'Allowed GST slabs only: 0, 3, 5, 9, 18.';

-- -----------------------------------------------------------------------------
-- 4) Product images kind + variants barcode
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.product_image_kind as enum ('website', 'internal');
exception when duplicate_object then null; end $$;

alter table public.product_images
  add column if not exists image_kind public.product_image_kind not null default 'website';

create index if not exists product_images_product_kind_idx
  on public.product_images (product_id, image_kind, sort_order);

alter table public.product_variants
  add column if not exists barcode text;

create unique index if not exists product_variants_barcode_uidx
  on public.product_variants (barcode) where barcode is not null;

comment on column public.product_images.image_kind is
  'website = customer gallery; internal = staff-only reference photos.';

-- -----------------------------------------------------------------------------
-- 5) Unique piece units (hang-tag barcodes)
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.product_item_status as enum (
    'to_sell', 'sold', 'returned', 'damaged', 'reserved'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'product_item_status' and e.enumlabel = 'reserved'
  ) then
    alter type public.product_item_status add value 'reserved';
  end if;
end $$;

create table if not exists public.product_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  tag text not null,
  seq integer not null,
  unit_code text not null unique,
  barcode text not null unique,
  status public.product_item_status not null default 'to_sell',
  damage_detail text,
  date_added timestamptz not null default now(),
  date_sold timestamptz,
  bill_id uuid references public.orders(id) on delete set null,
  label_printed boolean not null default false,
  unique (product_id, seq)
);

create index if not exists product_items_product_status_idx
  on public.product_items (product_id, status);
create index if not exists product_items_variant_status_idx
  on public.product_items (variant_id, status);
create index if not exists product_items_barcode_idx
  on public.product_items (barcode);

create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  price numeric(12,2) not null,
  recorded_at timestamptz not null default now()
);

create index if not exists product_price_history_product_idx
  on public.product_price_history (product_id, recorded_at desc);

comment on table public.product_items is
  'One row per physical piece / hang-tag. Canonical sellable count = status to_sell.';
comment on table public.product_price_history is
  'Append-only selling price history for audits.';

-- -----------------------------------------------------------------------------
-- 6) Orders: POS + shop/brand + courier tracking
-- Why courier_* on orders: one AWB per order in current retail flow (no parcel table yet).
-- -----------------------------------------------------------------------------
alter table public.orders
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists channel text not null default 'online',
  add column if not exists shop_id uuid,
  add column if not exists brand_id uuid,
  add column if not exists pos_customer_name text,
  add column if not exists pos_customer_phone text,
  add column if not exists pos_customer_email text,
  add column if not exists courier_name text,
  add column if not exists courier_awb text,
  add column if not exists courier_note text;

do $$ begin
  alter table public.orders
    add constraint orders_channel_chk check (channel in ('online', 'pos'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.orders
    add constraint orders_shop_id_fkey foreign key (shop_id) references public.shops(id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.orders
    add constraint orders_brand_id_fkey foreign key (brand_id) references public.brands(id);
exception when duplicate_object then null; end $$;

create index if not exists orders_channel_created_idx
  on public.orders (channel, created_at desc);
create index if not exists orders_courier_awb_idx
  on public.orders (courier_awb) where courier_awb is not null;
create index if not exists orders_shop_id_idx
  on public.orders (shop_id) where shop_id is not null;

comment on column public.orders.channel is 'online = website checkout; pos = in-store billing.';
comment on column public.orders.courier_awb is
  'Air Waybill / tracking number shown on courier label and customer order page.';
comment on column public.orders.courier_name is 'Carrier name (e.g. DTDC, Delhivery).';

alter table public.order_items
  add column if not exists hsn_code text,
  add column if not exists gst_rate numeric(5,2);

-- -----------------------------------------------------------------------------
-- 7) Suppliers + GRN (goods receipt note) with approval gate
-- -----------------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  trade_name text,
  contact_person text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  state_code text,
  pincode text,
  gstin text,
  pan text,
  bank_name text,
  bank_account text,
  bank_ifsc text,
  payment_terms text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_code_nonempty check (length(trim(code)) > 0),
  constraint suppliers_name_nonempty check (length(trim(name)) > 0)
);

create unique index if not exists suppliers_code_unique_idx on public.suppliers (lower(code));
create unique index if not exists suppliers_gstin_unique_idx
  on public.suppliers (upper(gstin))
  where gstin is not null and length(trim(gstin)) > 0;
create index if not exists suppliers_active_name_idx on public.suppliers (is_active, name);

alter table public.inventory_movements
  add column if not exists supplier_id uuid references public.suppliers(id);

create index if not exists inventory_movements_supplier_id_idx
  on public.inventory_movements (supplier_id) where supplier_id is not null;

create table if not exists public.inventory_grns (
  id uuid primary key default gen_random_uuid(),
  grn_number text not null unique,
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'cancelled')),
  supplier_id uuid references public.suppliers(id),
  bill_no text,
  invoice_date date,
  document_path text,
  invoice_amount numeric(12,2),
  lines_total numeric(12,2) not null default 0,
  note text,
  created_by uuid references public.users(id),
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_grn_lines (
  id uuid primary key default gen_random_uuid(),
  grn_id uuid not null references public.inventory_grns(id) on delete cascade,
  product_variant_id uuid not null references public.product_variants(id),
  quantity integer not null check (quantity > 0),
  purchase_price numeric(12,2) not null check (purchase_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  sort_order integer not null default 0
);

create index if not exists inventory_grns_status_created_idx
  on public.inventory_grns (status, created_at desc);

create unique index if not exists inventory_grns_supplier_bill_active_uidx
  on public.inventory_grns (supplier_id, lower(btrim(bill_no)))
  where bill_no is not null
    and btrim(bill_no) <> ''
    and status in ('pending_approval', 'approved');

create index if not exists inventory_grn_lines_grn_id_idx
  on public.inventory_grn_lines (grn_id, sort_order);

drop trigger if exists trg_inventory_grns_updated_at on public.inventory_grns;
create trigger trg_inventory_grns_updated_at
before update on public.inventory_grns
for each row execute function public.set_updated_at();

drop trigger if exists trg_suppliers_updated_at on public.suppliers;
create trigger trg_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

comment on table public.suppliers is
  'Purchase vendor master. Required on every GRN.';
comment on table public.inventory_grns is
  'Goods Receipt Note header. Stock increases only after status=approved.';
comment on table public.inventory_grn_lines is
  'GRN line items (variant qty + purchase price).';
comment on column public.inventory_grns.invoice_date is
  'Supplier invoice date (may differ from GRN created_at).';
comment on column public.inventory_grns.document_path is
  'Uploaded PDF/image path under /uploads/grn-invoices/.';
comment on column public.inventory_grns.bill_no is
  'Supplier bill number. Unique per supplier while GRN is pending/approved.';

-- -----------------------------------------------------------------------------
-- 8) Password reset tokens (local auth)
-- -----------------------------------------------------------------------------
create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_tokens_user_idx
  on public.password_reset_tokens (user_id, created_at desc);

create index if not exists password_reset_tokens_active_idx
  on public.password_reset_tokens (expires_at)
  where used_at is null;

comment on table public.password_reset_tokens is
  'One-time customer password reset. Stores SHA-256(token), never the raw token.';

-- -----------------------------------------------------------------------------
-- 9) Finance core
-- -----------------------------------------------------------------------------
create table if not exists public.finance_payment_entries (
  id uuid primary key default gen_random_uuid(),
  entry_no text not null,
  direction text not null check (direction in ('in', 'out')),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null default 'cash',
  status text not null default 'cleared' check (status in ('pending', 'cleared', 'cancelled')),
  entry_date date not null default (current_date),
  counterparty_name text,
  reference_no text,
  notes text,
  order_id uuid references public.orders(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  shop_id uuid references public.shops(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_payment_entries
  add column if not exists reference_type text,
  add column if not exists reference_id text,
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null,
  add column if not exists tax_amount numeric(12,2) not null default 0,
  add column if not exists updated_by uuid references public.users(id) on delete set null;

create unique index if not exists finance_payment_entries_entry_no_uidx
  on public.finance_payment_entries (lower(entry_no));
create unique index if not exists finance_payment_entries_payment_uidx
  on public.finance_payment_entries (payment_id) where payment_id is not null;
create index if not exists finance_payment_entries_date_idx
  on public.finance_payment_entries (entry_date desc, created_at desc);

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  account_type text not null check (account_type in (
    'asset', 'liability', 'equity', 'income', 'expense'
  )),
  parent_code text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_accounts_code_nonempty check (length(trim(code)) > 0),
  constraint finance_accounts_name_nonempty check (length(trim(name)) > 0)
);

create unique index if not exists finance_accounts_code_uidx
  on public.finance_accounts (lower(code));

create table if not exists public.finance_cash_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  kind text not null check (kind in ('cash', 'bank')),
  opening_balance numeric(14,2) not null default 0,
  is_default boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_cash_accounts_code_nonempty check (length(trim(code)) > 0)
);

create unique index if not exists finance_cash_accounts_code_uidx
  on public.finance_cash_accounts (lower(code));

comment on table public.finance_payment_entries is
  'Cashbook / payment ledger (in/out). Links optionally to orders/payments.';
comment on table public.finance_accounts is 'Chart of accounts for P&L / balance reporting.';
comment on table public.finance_cash_accounts is 'Cash and bank wallets with opening balances.';

-- -----------------------------------------------------------------------------
-- 10) Stock integrity repair
-- Prefer product_items (to_sell) when units exist; else keep variant qty.
-- Then roll product.stock_quantity from variants.
-- -----------------------------------------------------------------------------
update public.product_variants v
set stock_quantity = sub.sellable
from (
  select variant_id, count(*)::int as sellable
  from public.product_items
  where status = 'to_sell'
  group by variant_id
) sub
where v.id = sub.variant_id
  and v.stock_quantity <> sub.sellable;

update public.products p
set stock_quantity = coalesce((
  select sum(v.stock_quantity)::int
  from public.product_variants v
  where v.product_id = p.id
), 0),
updated_at = now()
where p.stock_quantity is distinct from coalesce((
  select sum(v.stock_quantity)::int
  from public.product_variants v
  where v.product_id = p.id
), 0);

create or replace function public.sync_product_stock_from_variants()
returns trigger
language plpgsql
as $$
declare
  pid uuid;
begin
  pid := coalesce(new.product_id, old.product_id);
  update public.products p
  set stock_quantity = coalesce((
        select sum(v.stock_quantity)::integer
        from public.product_variants v
        where v.product_id = pid
      ), 0),
      updated_at = now()
  where p.id = pid;
  return null;
end;
$$;

drop trigger if exists trg_variants_sync_product_stock on public.product_variants;
create trigger trg_variants_sync_product_stock
after insert or update of stock_quantity, product_id or delete
on public.product_variants
for each row execute function public.sync_product_stock_from_variants();

-- -----------------------------------------------------------------------------
-- 11) Core table comments for DBA walkthrough
-- -----------------------------------------------------------------------------
comment on table public.users is 'Authentication identities for staff and customers.';
comment on table public.roles is 'RBAC role catalog. code is a stable permission key.';
comment on table public.user_roles is 'Many-to-many: users ↔ roles.';
comment on table public.categories is 'Product Master: top-level taxonomy.';
comment on table public.subcategories is 'Product Master: children of categories.';
comment on table public.collections is 'Merchandising groups (M:N with products).';
comment on table public.products is
  'Product Master header. stock_quantity is a rollup of variants.';
comment on table public.product_variants is
  'Sellable SKUs. Aggregate stock for cart/POS (derived from product_items when used).';
comment on table public.product_images is 'Ordered product gallery images.';
comment on table public.product_collections is 'Bridge table: products ↔ collections.';
comment on table public.customers is '1:1 extension of users for shoppers (shared PK).';
comment on table public.addresses is 'Customer addresses. At most one is_default=true per customer.';
comment on table public.carts is 'One active cart per customer.';
comment on table public.cart_items is 'Cart lines keyed by product + optional variant.';
comment on table public.orders is 'Order headers for online and POS channels.';
comment on table public.order_items is 'Line snapshots (names/prices frozen at purchase).';
comment on table public.payments is 'Payment attempts. Protected with ON DELETE RESTRICT.';
comment on table public.inventory_movements is 'Immutable stock ledger against variants.';
comment on table public.coupons is 'Discount definitions / gift vouchers.';
comment on table public.coupon_usage is 'Coupon redemption ledger.';
comment on table public.order_returns is 'RMA headers.';
comment on table public.return_items is 'RMA lines linked to original order_items.';
comment on table public.reviews is 'Product ratings and testimonials.';
comment on table public.audit_logs is 'Admin mutation audit trail.';
comment on table public.site_settings is 'Key/value store for site config and feature flags.';
comment on table public.menus is 'CMS navigation menus (header/footer).';
comment on table public.menu_items is 'Menu links; parent_id supports nested items.';
comment on table public.page_sections is 'Homepage / CMS section definitions by page_slug.';
comment on table public.section_items is 'Items inside a page section (cards, slides, links).';
comment on table public.banners is 'Promotional banners with optional date window.';
comment on table public.website_pages is 'Static CMS pages (policies, about, etc.).';
comment on table public.taxes is 'Tax master (rate definitions for billing).';
comment on table public.payment_methods is 'Enabled payment methods for storefront/POS.';
comment on table public.wishlists is 'Customer wishlist headers.';
comment on table public.wishlist_items is 'Wishlist lines keyed by product + optional variant.';
comment on table public.contact_messages is 'Public contact-form inbox.';
