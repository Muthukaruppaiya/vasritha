-- =============================================================================
-- Vasritha DBA schema optimize v3 — scale for 10k+ SKUs / pieces
-- Safe to re-run. Apply: npm run db:optimize
-- =============================================================================

create extension if not exists pg_trgm;

-- Shop-scoped piece lookups (POS / sync / cart)
do $$ begin
  if to_regclass('public.product_items') is not null then
    alter table public.product_items
      add column if not exists shop_id uuid references public.shops(id);
    create index if not exists product_items_shop_variant_status_idx
      on public.product_items (shop_id, variant_id, status);
    create index if not exists product_items_shop_to_sell_idx
      on public.product_items (shop_id, variant_id)
      where status = 'to_sell' and shop_id is not null;
    create index if not exists product_items_variant_to_sell_idx
      on public.product_items (variant_id)
      where status = 'to_sell';
    create index if not exists product_items_barcode_upper_idx
      on public.product_items (upper(barcode));
    create index if not exists product_items_unit_code_upper_idx
      on public.product_items (upper(unit_code));
  end if;
end $$;

-- Catalogue / inventory search (ILIKE '%term%')
create index if not exists products_name_trgm_idx
  on public.products using gin (name gin_trgm_ops);

create index if not exists products_sku_trgm_idx
  on public.products using gin (sku gin_trgm_ops)
  where sku is not null;

create index if not exists product_variants_sku_trgm_idx
  on public.product_variants using gin (sku gin_trgm_ops)
  where sku is not null;

create index if not exists product_variants_barcode_upper_idx
  on public.product_variants (upper(barcode))
  where barcode is not null;

create index if not exists products_barcode_upper_idx
  on public.products (upper(barcode))
  where barcode is not null;

create index if not exists products_sku_upper_idx
  on public.products (upper(sku))
  where sku is not null;

-- Per-shop rollup (requires shops + product_variants)
do $$ begin
  if to_regclass('public.shops') is not null
     and to_regclass('public.product_variants') is not null then
    create table if not exists public.shop_variant_stock (
      shop_id uuid not null references public.shops(id) on delete cascade,
      variant_id uuid not null references public.product_variants(id) on delete cascade,
      stock_quantity integer not null default 0,
      updated_at timestamptz not null default now(),
      primary key (shop_id, variant_id),
      constraint shop_variant_stock_qty_nonneg check (stock_quantity >= 0)
    );
    create index if not exists shop_variant_stock_variant_idx
      on public.shop_variant_stock (variant_id);
    create index if not exists shop_variant_stock_qty_idx
      on public.shop_variant_stock (shop_id, stock_quantity);
  end if;
end $$;

-- Movements / orders by shop
do $$ begin
  if to_regclass('public.inventory_movements') is not null then
    alter table public.inventory_movements
      add column if not exists shop_id uuid references public.shops(id);
    create index if not exists inventory_movements_shop_created_idx
      on public.inventory_movements (shop_id, created_at desc)
      where shop_id is not null;
  end if;
end $$;

do $$ begin
  if to_regclass('public.orders') is not null then
    alter table public.orders
      add column if not exists shop_id uuid references public.shops(id);
    create index if not exists orders_shop_channel_created_idx
      on public.orders (shop_id, channel, created_at desc)
      where shop_id is not null;
  end if;
end $$;

do $$ begin
  if to_regclass('public.inventory_grns') is not null then
    alter table public.inventory_grns
      add column if not exists shop_id uuid references public.shops(id);
    create index if not exists inventory_grns_shop_status_created_idx
      on public.inventory_grns (shop_id, status, created_at desc)
      where shop_id is not null;
  end if;
end $$;

alter table public.users
  add column if not exists shop_id uuid references public.shops(id);

create index if not exists users_shop_id_idx
  on public.users (shop_id)
  where shop_id is not null;

comment on index public.product_items_shop_variant_status_idx is
  'Scale: per-store piece counts and sellable sync.';
comment on index public.products_name_trgm_idx is
  'Scale: inventory/product search with ILIKE.';
