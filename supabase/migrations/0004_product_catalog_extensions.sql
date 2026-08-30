-- Align Supabase-hosted DB with admin product create API.

create extension if not exists pgcrypto;

do $$ begin
  create type public.product_item_status as enum ('to_sell','sold','returned','damaged','reserved');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_label_size as enum ('accessory','dress');
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
  add column if not exists parent_product_id uuid references public.products(id) on delete set null,
  add column if not exists hsn_code text,
  add column if not exists gst_rate numeric(5,2) not null default 5;

alter table public.product_variants
  add column if not exists barcode text;

create unique index if not exists products_sku_unique_idx on public.products (sku) where sku is not null;
create unique index if not exists products_barcode_unique_idx on public.products (barcode) where barcode is not null;
