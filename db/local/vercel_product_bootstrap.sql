-- Run once on hosted Postgres (Supabase SQL editor or npm run db:patch:vercel-products)
-- Brings older production schemas in line with admin product create API.

create extension if not exists pgcrypto;

do $$ begin
  create type public.product_item_status as enum ('to_sell','sold','returned','damaged','reserved');
exception when duplicate_object then null;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'product_item_status' and e.enumlabel = 'reserved'
  ) then
    alter type public.product_item_status add value 'reserved';
  end if;
end $$;

do $$ begin
  create type public.product_label_size as enum ('accessory','dress');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_image_kind as enum ('website', 'internal');
exception when duplicate_object then null;
end $$;

alter table public.products
  add column if not exists sku text,
  add column if not exists barcode text,
  add column if not exists short_name text not null default '',
  add column if not exists short_description text not null default '',
  add column if not exists color text not null default '',
  add column if not exists is_featured boolean not null default false,
  add column if not exists tag text,
  add column if not exists sku_prefix text not null default 'VAS',
  add column if not exists label_size public.product_label_size not null default 'dress',
  add column if not exists image_upload_token uuid not null default gen_random_uuid(),
  add column if not exists parent_product_id uuid,
  add column if not exists hsn_code text,
  add column if not exists gst_rate numeric(5,2) not null default 5,
  add column if not exists brand_id uuid;

alter table public.product_variants
  add column if not exists barcode text;

alter table public.product_images
  add column if not exists image_kind public.product_image_kind not null default 'website';

create unique index if not exists products_sku_unique_idx
  on public.products (sku) where sku is not null;

create unique index if not exists products_barcode_unique_idx
  on public.products (barcode) where barcode is not null;

create unique index if not exists products_image_upload_token_idx
  on public.products (image_upload_token);

create index if not exists products_parent_product_id_idx
  on public.products (parent_product_id)
  where parent_product_id is not null;

create index if not exists products_featured_idx
  on public.products (is_featured)
  where is_featured = true;

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

create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  price numeric(12,2) not null,
  recorded_at timestamptz not null default now()
);

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
  updated_at timestamptz not null default now()
);

create unique index if not exists brands_code_unique_idx on public.brands (lower(code));
create unique index if not exists brands_slug_unique_idx on public.brands (lower(slug));

insert into public.brands (code, name, slug, tagline, is_active, is_default, sort_order)
select 'VASRITHA', coalesce(nullif(trim(site_name), ''), 'Vasritha'), 'vasritha',
       coalesce(nullif(trim(tagline), ''), 'Timeless Elegance'), true, true, 0
from public.site_settings
where not exists (select 1 from public.brands)
limit 1;

insert into public.brands (code, name, slug, tagline, is_active, is_default, sort_order)
select 'VASRITHA', 'Vasritha', 'vasritha', 'Timeless Elegance', true, true, 0
where not exists (select 1 from public.brands);

do $$ begin
  alter table public.products
    add constraint products_brand_id_fkey foreign key (brand_id) references public.brands(id);
exception when duplicate_object then null;
end $$;

update public.products p
set brand_id = d.id
from public.brands d
where d.is_default and p.brand_id is null;

update public.products
set tag = coalesce(nullif(tag, ''), sku, slug)
where tag is null or tag = '';
