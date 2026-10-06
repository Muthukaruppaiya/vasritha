-- Per-store stock + store-bound users (safe to re-run)
-- Usage: npm run db:patch:shop-stock

alter table public.users
  add column if not exists shop_id uuid references public.shops(id);

create index if not exists users_shop_id_idx
  on public.users (shop_id)
  where shop_id is not null;

comment on column public.users.shop_id is
  'When set, staff is limited to this shop for stock/POS/orders. Null = all shops (owner/admin).';

alter table public.product_items
  add column if not exists shop_id uuid references public.shops(id);

alter table public.inventory_movements
  add column if not exists shop_id uuid references public.shops(id);

alter table public.orders
  add column if not exists shop_id uuid references public.shops(id);

create index if not exists product_items_shop_id_idx
  on public.product_items (shop_id)
  where shop_id is not null;

create index if not exists product_items_shop_variant_status_idx
  on public.product_items (shop_id, variant_id, status);

create index if not exists product_items_shop_to_sell_idx
  on public.product_items (shop_id, variant_id)
  where status = 'to_sell' and shop_id is not null;

create index if not exists inventory_movements_shop_id_idx
  on public.inventory_movements (shop_id)
  where shop_id is not null;

create index if not exists inventory_movements_shop_created_idx
  on public.inventory_movements (shop_id, created_at desc)
  where shop_id is not null;

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

comment on table public.shop_variant_stock is
  'Per-shop sellable qty rollup for a variant. Synced from product_items (to_sell).';

-- Backfill missing shop_id to default shop
update public.product_items pi
set shop_id = d.id
from public.shops d
where d.is_default
  and pi.shop_id is null;

update public.inventory_movements m
set shop_id = d.id
from public.shops d
where d.is_default
  and m.shop_id is null;

update public.orders o
set shop_id = d.id
from public.shops d
where d.is_default
  and o.shop_id is null
  and coalesce(o.channel, 'online') = 'pos';

-- Rebuild shop_variant_stock from pieces
insert into public.shop_variant_stock (shop_id, variant_id, stock_quantity, updated_at)
select
  pi.shop_id,
  pi.variant_id,
  count(*)::int,
  now()
from public.product_items pi
where pi.status = 'to_sell'
  and pi.shop_id is not null
group by pi.shop_id, pi.variant_id
on conflict (shop_id, variant_id) do update
  set stock_quantity = excluded.stock_quantity,
      updated_at = now();

-- Keep global variant qty as sum across shops (catalogue convenience)
update public.product_variants pv
set stock_quantity = coalesce((
  select sum(s.stock_quantity)::int
  from public.shop_variant_stock s
  where s.variant_id = pv.id
), (
  select count(*)::int
  from public.product_items i
  where i.variant_id = pv.id and i.status = 'to_sell'
));

update public.products p
set stock_quantity = coalesce((
  select sum(pv.stock_quantity)::int
  from public.product_variants pv
  where pv.product_id = p.id
), 0),
updated_at = now();
