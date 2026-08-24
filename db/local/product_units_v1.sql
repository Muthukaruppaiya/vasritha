-- Piece-level barcodes: one product (tag) → many unique items

do $$ begin
  create type public.product_item_status as enum (
    'to_sell',
    'sold',
    'returned',
    'damaged'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_label_size as enum ('accessory', 'dress');
exception
  when duplicate_object then null;
end $$;

alter table public.products
  add column if not exists tag text,
  add column if not exists sku_prefix text not null default 'VAS',
  add column if not exists label_size public.product_label_size not null default 'dress',
  add column if not exists image_upload_token uuid not null default gen_random_uuid();

create unique index if not exists products_image_upload_token_idx
  on public.products (image_upload_token);

update public.products
set tag = coalesce(nullif(tag, ''), sku, slug)
where tag is null or tag = '';

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

create index if not exists product_items_barcode_idx
  on public.product_items (barcode);

create index if not exists product_items_variant_status_idx
  on public.product_items (variant_id, status);

create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  price numeric(12,2) not null,
  recorded_at timestamptz not null default now()
);

create index if not exists product_price_history_product_idx
  on public.product_price_history (product_id, recorded_at desc);

comment on table public.product_items is
  'Unique physical piece / hang-tag barcode, connected to the product tag.';
comment on column public.products.tag is
  'Family tag that connects all unique piece barcodes of this product.';
comment on column public.products.image_upload_token is
  'Secret token for phone QR image upload.';
