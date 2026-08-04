-- Sprint 1: roles (top → bottom), ops tables for backend APIs
-- Compatible with existing 0001_init.sql

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

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code public.app_role not null unique,
  name text not null,
  description text,
  is_mvp boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.roles (code, name, description, is_mvp) values
  ('super_admin', 'Super Admin', 'Technical and master administration', true),
  ('business_owner', 'Business Owner', 'Overall business control', true),
  ('manager', 'Manager', 'Day-to-day supervision', true),
  ('billing_staff', 'Billing Staff', 'Retail billing / POS', true),
  ('inventory_staff', 'Inventory Staff', 'Stock operations', true),
  ('packing_shipping_staff', 'Packing & Shipping Staff', 'Order fulfillment', true),
  ('customer_support_staff', 'Customer Support Staff', 'Customer assistance', true),
  ('accountant', 'Accountant / Finance', 'Financial review', false),
  ('customer', 'Vasritha Customer', 'Online shopping and self-service', true)
on conflict (code) do nothing;

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  company_id uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index if not exists user_roles_user_id_idx on public.user_roles(user_id);

-- Map legacy admin_users → user_roles when present
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'admin_users') then
    insert into public.user_roles (user_id, role_id)
    select au.user_id, r.id
    from public.admin_users au
    join public.roles r on r.code = case au.role
      when 'owner' then 'business_owner'::public.app_role
      when 'admin' then 'manager'::public.app_role
      else 'billing_staff'::public.app_role
    end
    on conflict do nothing;
  end if;
end $$;

create or replace function app_private.user_role_codes(uid uuid default auth.uid())
returns public.app_role[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(r.code), '{}'::public.app_role[])
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = uid;
$$;

create or replace function app_private.has_staff_role(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = uid
      and r.code <> 'customer'
  );
$$;

-- Prefer new role check; keep legacy is_staff for old policies
create or replace function app_private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    app_private.has_staff_role()
    or exists (
      select 1 from public.admin_users where user_id = (select auth.uid())
    );
$$;

revoke all on function app_private.user_role_codes(uuid) from public, anon, authenticated;
revoke all on function app_private.has_staff_role(uuid) from public, anon, authenticated;

grant execute on function app_private.user_role_codes(uuid) to authenticated, service_role;
grant execute on function app_private.has_staff_role(uuid) to authenticated, service_role;

alter table public.roles enable row level security;
alter table public.user_roles enable row level security;

create policy "roles readable by authenticated"
  on public.roles for select to authenticated using (true);

create policy "staff manage roles"
  on public.roles for all to authenticated
  using ((select app_private.is_staff()))
  with check ((select app_private.is_staff()));

create policy "users read own roles"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select app_private.is_staff()));

create policy "staff manage user roles"
  on public.user_roles for all to authenticated
  using ((select app_private.is_staff()))
  with check ((select app_private.is_staff()));

-- Operational tables used by backend APIs (safe if already planned)
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (customer_id)
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, product_id, variant_id)
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

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references public.product_variants(id),
  type text not null check (type in ('sale', 'return', 'manual_adjustment', 'opening_stock')),
  quantity integer not null,
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_logs enable row level security;

create policy "customers manage own carts"
  on public.carts for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

create policy "customers manage own cart items"
  on public.cart_items for all to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.customer_id = (select auth.uid())))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.customer_id = (select auth.uid())));

create policy "customers manage own wishlists"
  on public.wishlists for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

create policy "customers manage own wishlist items"
  on public.wishlist_items for all to authenticated
  using (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.customer_id = (select auth.uid())))
  with check (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.customer_id = (select auth.uid())));

create policy "staff manage inventory movements"
  on public.inventory_movements for all to authenticated
  using ((select app_private.is_staff()))
  with check ((select app_private.is_staff()));

create policy "staff read audit logs"
  on public.audit_logs for select to authenticated
  using ((select app_private.is_staff()));

create policy "staff insert audit logs"
  on public.audit_logs for insert to authenticated
  with check ((select app_private.is_staff()));
