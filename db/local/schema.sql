-- Vasritha local PostgreSQL schema (temporary — not Supabase)
-- After create, apply integrity upgrade: db/local/optimize_v1.sql (npm run db:optimize)
-- Relationship walkthrough for DBA review: docs/DATABASE.md
create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  full_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.app_role as enum (
  'super_admin',
  'business_owner',
  'manager',
  'billing_staff',
  'inventory_staff',
  'packing_shipping_staff',
  'customer_support_staff',
  'accountant',
  'customer'
);

create type public.product_status as enum ('draft', 'active', 'archived');
create type public.order_status as enum ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.stock_status as enum ('in_stock', 'limited', 'out_of_stock');

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_mvp boolean not null default true,
  is_system boolean not null default false,
  permission_template text,
  created_at timestamptz not null default now()
);

insert into public.roles (code, name, description, is_mvp, is_system, permission_template) values
  ('super_admin', 'Super Admin', 'Technical and master administration', true, true, 'super_admin'),
  ('business_owner', 'Business Owner', 'Overall business control', true, true, 'business_owner'),
  ('manager', 'Manager', 'Day-to-day supervision', true, true, 'manager'),
  ('billing_staff', 'Billing Staff', 'Retail billing', true, true, 'billing_staff'),
  ('inventory_staff', 'Inventory Staff', 'Stock operations', true, true, 'inventory_staff'),
  ('packing_shipping_staff', 'Packing & Shipping Staff', 'Order fulfilment', true, true, 'packing_shipping_staff'),
  ('customer_support_staff', 'Customer Support Staff', 'Customer assistance', true, true, 'customer_support_staff'),
  ('accountant', 'Accountant / Finance', 'Financial review', false, true, 'accountant'),
  ('customer', 'Vasritha Customer', 'Online shopping and self-service', true, true, 'customer')
on conflict (code) do nothing;

create table if not exists public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  image_path text,
  sort_order integer not null default 0,
  name_i18n jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  unique (category_id, name)
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text
);

-- Sales brand plugins on Sukadhaa ops (e.g. Vasritha storefront)
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

create unique index if not exists brands_code_unique_idx
  on public.brands (lower(code));

create unique index if not exists brands_slug_unique_idx
  on public.brands (lower(slug));

create unique index if not exists brands_one_default_idx
  on public.brands ((1))
  where is_default;

create index if not exists brands_active_idx
  on public.brands (is_active, sort_order, name);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  subcategory_id uuid references public.subcategories(id),
  brand_id uuid references public.brands(id),
  name text not null,
  short_name text not null default '',
  slug text not null unique,
  sku text unique,
  barcode text unique,
  short_description text not null default '',
  color text not null default '',
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2),
  hsn_code text,
  gst_rate numeric(5,2) not null default 5,
  status public.product_status not null default 'draft',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_featured boolean not null default false,
  featured_order integer not null default 0,
  parent_product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_collections (
  product_id uuid not null references public.products(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  primary key (product_id, collection_id)
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order integer not null default 0,
  image_kind text not null default 'website' check (image_kind in ('website', 'internal'))
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sku text not null unique,
  barcode text unique,
  price numeric(12,2) not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  attributes jsonb not null default '{}'::jsonb
);

create table if not exists public.customers (
  id uuid primary key references public.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'India',
  is_default boolean not null default false
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade unique,
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null default 'Default',
  created_at timestamptz not null default now(),
  unique (customer_id, name)
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  created_at timestamptz not null default now()
);

-- Physical store locations (multi-shop ready)
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

create unique index if not exists shops_code_unique_idx
  on public.shops (lower(code));

create unique index if not exists shops_one_default_idx
  on public.shops ((1))
  where is_default;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.customers(id),
  shipping_address_id uuid references public.addresses(id),
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  shipping_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  channel text not null default 'online' check (channel in ('online', 'pos')),
  shop_id uuid references public.shops(id),
  brand_id uuid references public.brands(id),
  pos_customer_name text,
  pos_customer_phone text,
  pos_customer_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  variant_id uuid references public.product_variants(id),
  product_name text not null,
  variant_name text,
  sku text,
  hsn_code text,
  gst_rate numeric(5,2),
  unit_price numeric(12,2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  provider text not null,
  provider_payment_id text unique,
  amount numeric(12,2) not null,
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.taxes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  rate numeric(5,2) not null,
  is_inclusive boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  provider text not null default 'manual',
  is_online boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.payment_methods (name, code, provider, is_online, sort_order) values
  ('UPI', 'upi', 'razorpay', true, 1),
  ('Card', 'card', 'razorpay', true, 2),
  ('Netbanking', 'netbanking', 'razorpay', true, 3),
  ('Cash', 'cash', 'manual', false, 4)
on conflict (code) do nothing;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12,2) not null,
  min_order_amount numeric(12,2) not null default 0,
  max_discount_amount numeric(12,2),
  usage_limit integer,
  usage_limit_per_customer integer,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'active',
  kind text not null default 'coupon',
  show_on_open boolean not null default false,
  headline text,
  created_at timestamptz not null default now()
);

create table if not exists public.coupon_usage (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id),
  customer_id uuid not null references public.customers(id),
  order_id uuid references public.orders(id),
  discount_amount numeric(12,2) not null default 0,
  used_at timestamptz not null default now()
);

create table if not exists public.order_returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  return_number text not null unique,
  status text not null default 'requested',
  reason text,
  refund_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.order_returns(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id),
  quantity integer not null check (quantity > 0),
  reason text
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references public.product_variants(id),
  type text not null,
  quantity integer not null,
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid references public.users(id),
  shop_id uuid references public.shops(id),
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  site_name text not null default 'Vasritha',
  tagline text,
  logo_path text,
  header_logo_path text,
  favicon_path text,
  support_email text,
  support_phone text,
  whatsapp_number text,
  currency text not null default 'INR',
  free_shipping_min numeric(12,2),
  social_links jsonb not null default '{}'::jsonb,
  seo_title text,
  seo_description text,
  company_legal_name text,
  company_address text,
  company_gstin text,
  company_state text,
  company_state_code text,
  prices_inclusive_of_gst boolean not null default true,
  default_brand_id uuid references public.brands(id),
  updated_at timestamptz not null default now()
);

insert into public.site_settings (site_name, tagline, support_email, whatsapp_number, free_shipping_min)
select 'Vasritha', 'Timeless Elegance', 'hello@vasritha.com', '919000000000', 2500
where not exists (select 1 from public.site_settings);

insert into public.brands (
  code, name, slug, tagline, support_email, support_phone, is_active, is_default, sort_order
)
select
  'VASRITHA',
  coalesce(nullif(trim(site_name), ''), 'Vasritha'),
  'vasritha',
  coalesce(nullif(trim(tagline), ''), 'Timeless Elegance'),
  support_email,
  support_phone,
  true,
  true,
  0
from public.site_settings
where not exists (select 1 from public.brands)
limit 1;

insert into public.brands (code, name, slug, tagline, is_active, is_default, sort_order)
select 'VASRITHA', 'Vasritha', 'vasritha', 'Timeless Elegance', true, true, 0
where not exists (select 1 from public.brands);

update public.site_settings ss
set default_brand_id = d.id
from public.brands d
where d.is_default
  and ss.default_brand_id is null;

insert into public.shops (code, name, is_active, is_default, brand_id)
select 'MAIN', 'Main Store', true, true, d.id
from public.brands d
where d.is_default
  and not exists (select 1 from public.shops)
limit 1;

insert into public.shops (code, name, is_active, is_default)
select 'MAIN', 'Main Store', true, true
where not exists (select 1 from public.shops);

update public.shops s
set brand_id = d.id
from public.brands d
where d.is_default
  and s.brand_id is null;

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus(id) on delete cascade,
  parent_id uuid references public.menu_items(id) on delete set null,
  label text not null,
  link_type text not null,
  link_value text,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  opens_in_new_tab boolean not null default false
);

insert into public.menus (code, name) values
  ('main_nav', 'Main Navigation'),
  ('mobile_drawer', 'Mobile Drawer'),
  ('footer_shop', 'Footer Shop'),
  ('footer_legal', 'Footer Legal')
on conflict (code) do nothing;

create table if not exists public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null default 'home',
  section_type text not null,
  title text,
  subtitle text,
  eyebrow text,
  cta_label text,
  cta_link text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.section_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.page_sections(id) on delete cascade,
  item_type text not null,
  item_id uuid,
  title text,
  subtitle text,
  image_path text,
  link_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_path text not null,
  link_url text,
  placement text not null default 'home_hero',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.website_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null default '',
  seo_title text,
  seo_description text,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.website_pages (slug, title, body, is_published) values
  ('about', 'About Vasritha', 'About content', true),
  ('contact', 'Contact', 'Contact content', true),
  ('privacy', 'Privacy Policy', 'Privacy content', false),
  ('terms', 'Terms of Service', 'Terms content', false)
on conflict (slug) do nothing;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  reviewer_email text,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text not null,
  image_path text,
  is_featured boolean not null default false,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- Seed categories
insert into public.categories (name, slug, description, sort_order) values
  ('Sarees', 'sarees', 'Timeless drapes for every occasion.', 1),
  ('Jewelry', 'jewelry', 'Finishing touches with enduring radiance.', 2),
  ('Churidhars / Salwars', 'churidhars-salwars', 'Graceful everyday and occasion wear.', 3),
  ('Handcrafted', 'handcrafted', 'Artful pieces for thoughtful homes.', 4)
on conflict (slug) do nothing;

insert into public.collections (name, slug, description) values
  ('Kanchipuram Silk', 'kanchipuram-silk', 'Heritage silk with luminous zari work.'),
  ('Banarasi Silk', 'banarasi-silk', 'Rich woven traditions for celebrations.'),
  ('Soft Silk', 'soft-silk', 'Lightweight grace with a luxurious finish.'),
  ('Tussar Silk', 'tussar-silk', 'Natural texture and understated elegance.'),
  ('Cotton Weaves', 'cotton-weaves', 'Comfortable handwoven beauty.')
on conflict (slug) do nothing;

-- Allow custom admin roles (code as text + optional permission template)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'roles'
      and column_name = 'code'
      and udt_name = 'app_role'
  ) then
    alter table public.roles alter column code type text using code::text;
  end if;
end $$;

alter table public.roles add column if not exists permission_template text;
alter table public.roles add column if not exists is_system boolean not null default false;

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
);

-- Performance indexes for storefront / admin catalogs
create index if not exists products_status_idx on public.products (status);
create index if not exists products_category_status_idx on public.products (category_id, status);
create index if not exists products_featured_idx on public.products (is_featured) where is_featured = true;
create index if not exists products_brand_id_idx on public.products (brand_id) where brand_id is not null;
create index if not exists orders_brand_id_idx on public.orders (brand_id) where brand_id is not null;
create index if not exists product_images_product_id_idx on public.product_images (product_id, sort_order);
create index if not exists product_variants_product_id_idx on public.product_variants (product_id);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists menu_items_menu_id_idx on public.menu_items (menu_id);
create index if not exists banners_active_sort_idx on public.banners (is_active, sort_order);
create index if not exists page_sections_page_active_idx on public.page_sections (page_slug, is_active, sort_order);

