-- Multi-brand plugin foundation (safe to re-run)
-- Ops platform = Sukadhaa; sales brands (Vasritha, …) plug in.
-- Usage: npm run db:patch:brands

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

comment on table public.brands is
  'Sales/brand plugins on Sukadhaa ops (e.g. Vasritha). Ops stay Sukadhaa; storefronts are brand-facing.';
comment on column public.brands.code is 'Short unique code e.g. VASRITHA';
comment on column public.brands.is_default is 'Default brand for catalogue / online when none selected.';

-- Seed Vasritha as first brand plugin
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

-- Ensure exactly one default
update public.brands b
set is_default = true, updated_at = now()
where b.id = (
  select id from public.brands
  where is_active
  order by is_default desc, sort_order asc, created_at asc
  limit 1
)
and not exists (select 1 from public.brands where is_default);

alter table public.products
  add column if not exists brand_id uuid references public.brands(id);

alter table public.orders
  add column if not exists brand_id uuid references public.brands(id);

alter table public.site_settings
  add column if not exists default_brand_id uuid references public.brands(id);

alter table public.shops
  add column if not exists brand_id uuid references public.brands(id);

create index if not exists products_brand_id_idx
  on public.products (brand_id)
  where brand_id is not null;

create index if not exists orders_brand_id_idx
  on public.orders (brand_id)
  where brand_id is not null;

-- Backfill to default brand
update public.products p
set brand_id = d.id
from public.brands d
where d.is_default
  and p.brand_id is null;

update public.orders o
set brand_id = d.id
from public.brands d
where d.is_default
  and o.brand_id is null;

update public.shops s
set brand_id = d.id
from public.brands d
where d.is_default
  and s.brand_id is null;

update public.site_settings ss
set default_brand_id = d.id
from public.brands d
where d.is_default
  and ss.default_brand_id is null;
