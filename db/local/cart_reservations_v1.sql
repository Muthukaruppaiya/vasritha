-- 30-minute cart stock holds (safe to re-run)
-- Usage: npm run db:patch:cart-reservations

do $$ begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'product_item_status'
      and e.enumlabel = 'reserved'
  ) then
    alter type public.product_item_status add value 'reserved';
  end if;
end $$;

create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  session_key text not null,
  customer_id uuid references public.customers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  product_item_id uuid references public.product_items(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stock_reservations_session_idx
  on public.stock_reservations (session_key, expires_at);

create index if not exists stock_reservations_customer_idx
  on public.stock_reservations (customer_id, expires_at)
  where customer_id is not null;

create index if not exists stock_reservations_variant_active_idx
  on public.stock_reservations (variant_id, expires_at)
  where variant_id is not null;

create index if not exists stock_reservations_expires_idx
  on public.stock_reservations (expires_at);

create unique index if not exists stock_reservations_item_active_uidx
  on public.stock_reservations (product_item_id)
  where product_item_id is not null;

comment on table public.stock_reservations is
  'Soft stock holds while items sit in bag. Expire after 30 minutes if unpaid.';

alter table public.cart_items
  add column if not exists reserved_until timestamptz,
  add column if not exists session_key text;

comment on column public.cart_items.reserved_until is 'When the soft hold for this line expires.';
