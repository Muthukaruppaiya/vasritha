-- Multi-shop / multi-location provision (safe to re-run)
-- Usage: npm run db:patch:shops

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

-- At most one default shop
create unique index if not exists shops_one_default_idx
  on public.shops ((1))
  where is_default;

create index if not exists shops_active_idx
  on public.shops (is_active, name);

comment on table public.shops is
  'Physical store / POS locations. Supports multiple shops; stock attribution via shop_id.';
comment on column public.shops.code is 'Short unique code e.g. MAIN, TIRUPUR-2';
comment on column public.shops.gstin is 'Optional shop GSTIN; null falls back to company GSTIN in site_settings.';
comment on column public.shops.is_default is 'Default POS / reporting shop when none selected.';

alter table public.orders
  add column if not exists shop_id uuid references public.shops(id);

alter table public.inventory_movements
  add column if not exists shop_id uuid references public.shops(id);

alter table public.product_items
  add column if not exists shop_id uuid references public.shops(id);

create index if not exists orders_shop_id_idx
  on public.orders (shop_id)
  where shop_id is not null;

create index if not exists inventory_movements_shop_id_idx
  on public.inventory_movements (shop_id)
  where shop_id is not null;

create index if not exists product_items_shop_id_idx
  on public.product_items (shop_id)
  where shop_id is not null;

-- Seed MAIN from company details when no shops exist
insert into public.shops (
  code, name, address, phone, email, state, state_code, gstin, is_active, is_default
)
select
  'MAIN',
  coalesce(nullif(trim(company_legal_name), ''), nullif(trim(site_name), ''), 'Main Store'),
  company_address,
  support_phone,
  support_email,
  company_state,
  company_state_code,
  company_gstin,
  true,
  true
from public.site_settings
where not exists (select 1 from public.shops)
limit 1;

-- If somehow shops exist but none is default, mark the earliest active one
update public.shops s
set is_default = true, updated_at = now()
where s.id = (
  select id from public.shops
  where is_active
  order by created_at asc
  limit 1
)
and not exists (select 1 from public.shops where is_default);

-- Backfill existing rows to default shop
update public.orders o
set shop_id = d.id
from public.shops d
where d.is_default
  and o.shop_id is null
  and coalesce(o.channel, 'online') = 'pos';

update public.inventory_movements m
set shop_id = d.id
from public.shops d
where d.is_default
  and m.shop_id is null;

update public.product_items pi
set shop_id = d.id
from public.shops d
where d.is_default
  and pi.shop_id is null;
