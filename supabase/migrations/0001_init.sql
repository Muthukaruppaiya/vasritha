create extension if not exists pgcrypto;
create schema if not exists app_private;

create type public.product_status as enum ('draft', 'active', 'archived');
create type public.order_status as enum ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.admin_role as enum ('owner', 'admin', 'staff');

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.admin_role not null default 'staff',
  created_at timestamptz not null default now()
);

create or replace function app_private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function app_private.is_staff() from public, anon, authenticated;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  unique (category_id, name)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  subcategory_id uuid references public.subcategories(id),
  name text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= price),
  status public.product_status not null default 'draft',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_collections (
  product_id uuid not null references public.products(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  primary key (product_id, collection_id)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order integer not null default 0
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sku text not null unique,
  price numeric(12,2) not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  attributes jsonb not null default '{}'::jsonb
);

create table public.customers (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table public.addresses (
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

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.customers(id),
  shipping_address_id uuid references public.addresses(id),
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  shipping_amount numeric(12,2) not null default 0 check (shipping_amount >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  variant_id uuid references public.product_variants(id),
  product_name text not null,
  variant_name text,
  sku text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  order_id uuid not null unique references public.orders(id),
  issued_at timestamptz not null default now(),
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  tax_rate numeric(5,2) not null default 0,
  line_total numeric(12,2) not null
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  provider text not null,
  provider_payment_id text unique,
  amount numeric(12,2) not null check (amount >= 0),
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index orders_customer_id_idx on public.orders(customer_id);
create index products_category_id_idx on public.products(category_id);
create index products_subcategory_id_idx on public.products(subcategory_id);

alter table public.admin_users enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.collections enable row level security;
alter table public.products enable row level security;
alter table public.product_collections enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.customers enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

create policy "catalog visible to everyone" on public.categories for select using (true);
create policy "subcategories visible to everyone" on public.subcategories for select using (true);
create policy "collections visible to everyone" on public.collections for select using (true);
create policy "active products visible to everyone" on public.products for select using (status = 'active' or (select app_private.is_staff()));
create policy "product relations visible to everyone" on public.product_collections for select using (true);
create policy "product images visible to everyone" on public.product_images for select using (true);
create policy "product variants visible to everyone" on public.product_variants for select using (true);

create policy "staff manage admin users" on public.admin_users for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "staff manage categories" on public.categories for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "staff manage subcategories" on public.subcategories for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "staff manage collections" on public.collections for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "staff manage products" on public.products for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "staff manage product relations" on public.product_collections for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "staff manage product images" on public.product_images for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "staff manage variants" on public.product_variants for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));

create policy "customers view self" on public.customers for select to authenticated using (id = (select auth.uid()));
create policy "customers update self" on public.customers for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "customers create self" on public.customers for insert to authenticated with check (id = (select auth.uid()));
create policy "customers view own addresses" on public.addresses for all to authenticated using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));
create policy "customers view own orders" on public.orders for select to authenticated using (customer_id = (select auth.uid()));
create policy "customers view own order items" on public.order_items for select to authenticated using (exists (select 1 from public.orders where orders.id = order_id and orders.customer_id = (select auth.uid())));
create policy "customers view own invoices" on public.invoices for select to authenticated using (exists (select 1 from public.orders where orders.id = order_id and orders.customer_id = (select auth.uid())));
create policy "customers view own invoice items" on public.invoice_items for select to authenticated using (exists (select 1 from public.invoices join public.orders on orders.id = invoices.order_id where invoices.id = invoice_id and orders.customer_id = (select auth.uid())));
create policy "customers view own payments" on public.payments for select to authenticated using (exists (select 1 from public.orders where orders.id = order_id and orders.customer_id = (select auth.uid())));

create policy "staff manage customers" on public.customers for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "staff manage orders" on public.orders for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "staff manage order items" on public.order_items for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "staff manage invoices" on public.invoices for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "staff manage invoice items" on public.invoice_items for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "staff manage payments" on public.payments for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
