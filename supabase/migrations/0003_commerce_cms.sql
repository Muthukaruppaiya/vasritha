-- Sprint 1 remaining commerce + CMS tables for full backend APIs

create table if not exists public.taxes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  rate numeric(5,2) not null check (rate >= 0),
  is_inclusive boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  provider text not null default 'manual',
  is_online boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.payment_methods (name, code, provider, is_online, sort_order) values
  ('UPI', 'upi', 'razorpay', true, 1),
  ('Card', 'card', 'razorpay', true, 2),
  ('Netbanking', 'netbanking', 'razorpay', true, 3),
  ('Cash', 'cash', 'manual', false, 4)
on conflict (code) do nothing;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12,2) not null check (discount_value >= 0),
  min_order_amount numeric(12,2) not null default 0,
  max_discount_amount numeric(12,2),
  usage_limit integer,
  usage_limit_per_customer integer,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active', 'inactive', 'expired')),
  created_at timestamptz not null default now()
);

create table if not exists public.coupon_usage (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id),
  customer_id uuid not null references public.customers(id),
  order_id uuid references public.orders(id),
  discount_amount numeric(12,2) not null default 0,
  used_at timestamptz not null default now()
);

create table if not exists public.order_returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  return_number text not null unique,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected', 'received', 'refunded')),
  reason text,
  refund_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.order_returns(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id),
  quantity integer not null check (quantity > 0),
  reason text
);

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  site_name text not null default 'Vasritha',
  tagline text,
  logo_path text,
  favicon_path text,
  support_email text,
  support_phone text,
  whatsapp_number text,
  currency text not null default 'INR',
  free_shipping_min numeric(12,2),
  social_links jsonb not null default '{}'::jsonb,
  seo_title text,
  seo_description text,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (site_name, tagline, support_email, whatsapp_number, free_shipping_min)
select 'Vasritha', 'Timeless Elegance', 'hello@vasritha.com', '919000000000', 2500
where not exists (select 1 from public.site_settings);

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus(id) on delete cascade,
  parent_id uuid references public.menu_items(id) on delete set null,
  label text not null,
  link_type text not null check (link_type in ('category', 'collection', 'page', 'product', 'custom_url', 'label_only')),
  link_value text,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  opens_in_new_tab boolean not null default false
);

insert into public.menus (code, name) values
  ('main_nav', 'Main Navigation'),
  ('mobile_drawer', 'Mobile Drawer'),
  ('footer_shop', 'Footer Shop'),
  ('footer_legal', 'Footer Legal')
on conflict (code) do nothing;

create table if not exists public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null default 'home',
  section_type text not null,
  title text,
  subtitle text,
  eyebrow text,
  cta_label text,
  cta_link text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.section_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.page_sections(id) on delete cascade,
  item_type text not null,
  item_id uuid,
  title text,
  subtitle text,
  image_path text,
  link_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_path text not null,
  link_url text,
  placement text not null default 'home_hero',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.website_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null default '',
  seo_title text,
  seo_description text,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.website_pages (slug, title, body, is_published) values
  ('about', 'About Vasritha', 'About content', true),
  ('contact', 'Contact', 'Contact content', true),
  ('privacy', 'Privacy Policy', 'Privacy content', false),
  ('terms', 'Terms of Service', 'Terms content', false)
on conflict (slug) do nothing;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  body text not null,
  is_featured boolean not null default false,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'closed')),
  created_at timestamptz not null default now()
);

-- RLS
alter table public.taxes enable row level security;
alter table public.payment_methods enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_usage enable row level security;
alter table public.order_returns enable row level security;
alter table public.return_items enable row level security;
alter table public.site_settings enable row level security;
alter table public.menus enable row level security;
alter table public.menu_items enable row level security;
alter table public.page_sections enable row level security;
alter table public.section_items enable row level security;
alter table public.banners enable row level security;
alter table public.website_pages enable row level security;
alter table public.reviews enable row level security;
alter table public.contact_messages enable row level security;

create policy "taxes public read" on public.taxes for select using (is_active = true or (select app_private.is_staff()));
create policy "taxes staff manage" on public.taxes for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));

create policy "payment methods public read" on public.payment_methods for select using (is_active = true or (select app_private.is_staff()));
create policy "payment methods staff manage" on public.payment_methods for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));

create policy "coupons staff manage" on public.coupons for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "coupons auth read active" on public.coupons for select to authenticated using (status = 'active' or (select app_private.is_staff()));

create policy "coupon usage staff" on public.coupon_usage for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "coupon usage own read" on public.coupon_usage for select to authenticated using (customer_id = (select auth.uid()));

create policy "returns staff manage" on public.order_returns for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "returns customer own" on public.order_returns for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())));
create policy "returns customer create" on public.order_returns for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())));

create policy "return items staff" on public.return_items for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "return items customer read" on public.return_items for select to authenticated
  using (exists (
    select 1 from public.order_returns r
    join public.orders o on o.id = r.order_id
    where r.id = return_id and o.customer_id = (select auth.uid())
  ));

create policy "settings public read" on public.site_settings for select using (true);
create policy "settings staff manage" on public.site_settings for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));

create policy "menus public read" on public.menus for select using (is_active = true or (select app_private.is_staff()));
create policy "menus staff manage" on public.menus for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "menu items public read" on public.menu_items for select using (is_active = true or (select app_private.is_staff()));
create policy "menu items staff manage" on public.menu_items for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));

create policy "sections public read" on public.page_sections for select using (is_active = true or (select app_private.is_staff()));
create policy "sections staff manage" on public.page_sections for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "section items public read" on public.section_items for select using (is_active = true or (select app_private.is_staff()));
create policy "section items staff manage" on public.section_items for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));

create policy "banners public read" on public.banners for select using (is_active = true or (select app_private.is_staff()));
create policy "banners staff manage" on public.banners for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));

create policy "pages public read published" on public.website_pages for select using (is_published = true or (select app_private.is_staff()));
create policy "pages staff manage" on public.website_pages for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));

create policy "reviews public approved" on public.reviews for select using (is_approved = true or (select app_private.is_staff()));
create policy "reviews staff manage" on public.reviews for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
create policy "reviews customer create" on public.reviews for insert to authenticated with check (true);

create policy "contact public insert" on public.contact_messages for insert with check (true);
create policy "contact staff manage" on public.contact_messages for all to authenticated using ((select app_private.is_staff())) with check ((select app_private.is_staff()));
