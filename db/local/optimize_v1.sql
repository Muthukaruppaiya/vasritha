-- =============================================================================
-- Vasritha DBA schema optimize v1
-- Safe to re-run on an existing database (IF NOT EXISTS / exception guards).
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) Stronger typed statuses (replace loose text where safe)
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.coupon_status as enum ('draft', 'active', 'expired', 'disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.return_status as enum ('requested', 'approved', 'rejected', 'received', 'refunded', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.inventory_movement_type as enum (
    'sale', 'return', 'manual_adjustment', 'opening_stock', 'purchase', 'transfer_in', 'transfer_out'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.channel_type as enum ('online', 'pos');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 2) Integrity helpers: timestamps
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists trg_order_returns_updated_at on public.order_returns;
create trigger trg_order_returns_updated_at
before update on public.order_returns
for each row execute function public.set_updated_at();

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_website_pages_updated_at on public.website_pages;
create trigger trg_website_pages_updated_at
before update on public.website_pages
for each row execute function public.set_updated_at();

drop trigger if exists trg_carts_updated_at on public.carts;
create trigger trg_carts_updated_at
before update on public.carts
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3) Stock model: variant is source of truth; product.stock_quantity is rollup
-- -----------------------------------------------------------------------------
create or replace function public.sync_product_stock_from_variants()
returns trigger
language plpgsql
as $$
declare
  pid uuid;
begin
  pid := coalesce(new.product_id, old.product_id);
  update public.products p
  set stock_quantity = coalesce((
        select sum(v.stock_quantity)::integer
        from public.product_variants v
        where v.product_id = pid
      ), 0),
      updated_at = now()
  where p.id = pid;
  return null;
end;
$$;

drop trigger if exists trg_variants_sync_product_stock on public.product_variants;
create trigger trg_variants_sync_product_stock
after insert or update of stock_quantity, product_id or delete
on public.product_variants
for each row execute function public.sync_product_stock_from_variants();

update public.products p
set stock_quantity = coalesce((
  select sum(v.stock_quantity)::integer
  from public.product_variants v
  where v.product_id = p.id
), 0);

-- -----------------------------------------------------------------------------
-- 4) Subcategory must belong to the product's category (composite FK)
-- -----------------------------------------------------------------------------
do $$ begin
  alter table public.subcategories
    add constraint subcategories_category_id_id_key unique (category_id, id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.products drop constraint if exists products_subcategory_id_fkey;
exception when undefined_object then null; end $$;

-- Clear orphan subcategory refs before composite FK
update public.products p
set subcategory_id = null
where subcategory_id is not null
  and not exists (
    select 1
    from public.subcategories s
    where s.id = p.subcategory_id
      and s.category_id = p.category_id
  );

do $$ begin
  alter table public.products
    add constraint products_category_subcategory_fkey
    foreign key (category_id, subcategory_id)
    references public.subcategories (category_id, id)
    on delete set null;
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 5) Missing / tightened CHECK constraints
-- -----------------------------------------------------------------------------
do $$ begin
  alter table public.products
    add constraint products_compare_at_price_chk
    check (compare_at_price is null or compare_at_price >= price);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.order_items
    add constraint order_items_line_total_chk
    check (line_total = round(unit_price * quantity, 2));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.order_items
    add constraint order_items_unit_price_chk
    check (unit_price >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.orders
    add constraint orders_amounts_chk
    check (
      discount_amount >= 0
      and tax_amount >= 0
      and shipping_amount >= 0
      and total_amount >= 0
    );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.payments
    add constraint payments_amount_chk check (amount >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.taxes
    add constraint taxes_rate_chk check (rate >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.coupons
    add constraint coupons_discount_value_chk check (discount_value > 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.coupons
    add constraint coupons_window_chk
    check (starts_at is null or ends_at is null or starts_at <= ends_at);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.banners
    add constraint banners_window_chk
    check (starts_at is null or ends_at is null or starts_at <= ends_at);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.inventory_movements
    add constraint inventory_movements_quantity_nonzero_chk
    check (quantity <> 0);
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 6) Uniqueness / business rules
-- -----------------------------------------------------------------------------
do $$ begin
  alter table public.customers
    add constraint customers_email_key unique (email);
exception when duplicate_object then null; end $$;

create unique index if not exists addresses_one_default_per_customer_uidx
  on public.addresses (customer_id)
  where is_default = true;

create unique index if not exists cart_items_cart_product_variant_uidx
  on public.cart_items (cart_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

create unique index if not exists wishlist_items_wishlist_product_variant_uidx
  on public.wishlist_items (wishlist_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

create unique index if not exists product_variants_product_name_uidx
  on public.product_variants (product_id, name);

create unique index if not exists coupon_usage_order_uidx
  on public.coupon_usage (order_id)
  where order_id is not null;

-- -----------------------------------------------------------------------------
-- 7) Foreign-key delete policies (history-safe)
-- -----------------------------------------------------------------------------
do $$ begin
  alter table public.payments drop constraint if exists payments_order_id_fkey;
  alter table public.payments
    add constraint payments_order_id_fkey
    foreign key (order_id) references public.orders(id) on delete restrict;
exception when others then null; end $$;

do $$ begin
  alter table public.coupon_usage drop constraint if exists coupon_usage_coupon_id_fkey;
  alter table public.coupon_usage
    add constraint coupon_usage_coupon_id_fkey
    foreign key (coupon_id) references public.coupons(id) on delete restrict;
exception when others then null; end $$;

do $$ begin
  alter table public.inventory_movements drop constraint if exists inventory_movements_product_variant_id_fkey;
  alter table public.inventory_movements
    add constraint inventory_movements_product_variant_id_fkey
    foreign key (product_variant_id) references public.product_variants(id) on delete restrict;
exception when others then null; end $$;

do $$ begin
  alter table public.order_items drop constraint if exists order_items_product_id_fkey;
  alter table public.order_items
    add constraint order_items_product_id_fkey
    foreign key (product_id) references public.products(id) on delete set null;
exception when others then null; end $$;

do $$ begin
  alter table public.order_items drop constraint if exists order_items_variant_id_fkey;
  alter table public.order_items
    add constraint order_items_variant_id_fkey
    foreign key (variant_id) references public.product_variants(id) on delete set null;
exception when others then null; end $$;

do $$ begin
  alter table public.cart_items drop constraint if exists cart_items_product_id_fkey;
  alter table public.cart_items
    add constraint cart_items_product_id_fkey
    foreign key (product_id) references public.products(id) on delete cascade;
exception when others then null; end $$;

do $$ begin
  alter table public.wishlist_items drop constraint if exists wishlist_items_product_id_fkey;
  alter table public.wishlist_items
    add constraint wishlist_items_product_id_fkey
    foreign key (product_id) references public.products(id) on delete cascade;
exception when others then null; end $$;

-- -----------------------------------------------------------------------------
-- 8) Missing FK / lookup indexes
-- -----------------------------------------------------------------------------
create index if not exists user_roles_role_id_idx on public.user_roles (role_id);
create index if not exists subcategories_category_id_idx on public.subcategories (category_id);
create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_subcategory_id_idx on public.products (subcategory_id);
create index if not exists product_collections_collection_id_idx on public.product_collections (collection_id);
create index if not exists addresses_customer_id_idx on public.addresses (customer_id);
create index if not exists cart_items_product_id_idx on public.cart_items (product_id);
create index if not exists cart_items_variant_id_idx on public.cart_items (variant_id);
create index if not exists wishlist_items_product_id_idx on public.wishlist_items (product_id);
create index if not exists wishlists_customer_id_idx on public.wishlists (customer_id);
create index if not exists orders_customer_id_idx on public.orders (customer_id);
create index if not exists orders_shipping_address_id_idx on public.orders (shipping_address_id);
create index if not exists orders_channel_created_idx on public.orders (channel, created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);
create index if not exists payments_order_id_idx on public.payments (order_id);
create index if not exists coupon_usage_coupon_id_idx on public.coupon_usage (coupon_id);
create index if not exists coupon_usage_customer_id_idx on public.coupon_usage (customer_id);
create index if not exists order_returns_order_id_idx on public.order_returns (order_id);
create index if not exists return_items_return_id_idx on public.return_items (return_id);
create index if not exists return_items_order_item_id_idx on public.return_items (order_item_id);
create index if not exists inventory_movements_variant_created_idx
  on public.inventory_movements (product_variant_id, created_at desc);
create index if not exists inventory_movements_type_created_idx
  on public.inventory_movements (type, created_at desc);
create index if not exists reviews_product_id_idx on public.reviews (product_id);
create index if not exists reviews_customer_id_idx on public.reviews (customer_id);
create index if not exists reviews_approved_featured_idx
  on public.reviews (is_approved, is_featured, created_at desc);
create index if not exists audit_logs_actor_created_idx on public.audit_logs (actor_user_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists menu_items_parent_id_idx on public.menu_items (parent_id);
create index if not exists section_items_section_id_idx on public.section_items (section_id);
create index if not exists customers_email_idx on public.customers (email);

create index if not exists products_status_idx on public.products (status);
create index if not exists products_category_status_idx on public.products (category_id, status);
create index if not exists products_featured_idx on public.products (is_featured) where is_featured = true;
create index if not exists product_images_product_id_idx on public.product_images (product_id, sort_order);
create index if not exists product_variants_product_id_idx on public.product_variants (product_id);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists menu_items_menu_id_idx on public.menu_items (menu_id);
create index if not exists banners_active_sort_idx on public.banners (is_active, sort_order);
create index if not exists page_sections_page_active_idx on public.page_sections (page_slug, is_active, sort_order);

-- -----------------------------------------------------------------------------
-- 9) Table comments for pgAdmin / client walkthrough
-- -----------------------------------------------------------------------------
comment on table public.users is 'Authentication identities for staff and customers.';
comment on table public.roles is 'RBAC role catalog. code is a stable permission key.';
comment on table public.user_roles is 'Many-to-many: users ↔ roles.';
comment on table public.categories is 'Product Master: top-level taxonomy.';
comment on table public.subcategories is 'Product Master: children of categories.';
comment on table public.collections is 'Merchandising groups (M:N with products).';
comment on table public.products is 'Product Master header. stock_quantity is a rollup of variants.';
comment on table public.product_variants is 'Sellable SKUs. Canonical stock and sellable price live here.';
comment on table public.product_images is 'Ordered product gallery images.';
comment on table public.product_collections is 'Bridge table: products ↔ collections.';
comment on table public.customers is '1:1 extension of users for shoppers (shared PK).';
comment on table public.addresses is 'Customer addresses. At most one is_default=true per customer.';
comment on table public.carts is 'One active cart per customer.';
comment on table public.cart_items is 'Cart lines keyed by product + optional variant.';
comment on table public.orders is 'Order headers for online and POS channels.';
comment on table public.order_items is 'Line snapshots (names/prices frozen at purchase).';
comment on table public.payments is 'Payment attempts. Protected with ON DELETE RESTRICT.';
comment on table public.inventory_movements is 'Immutable stock ledger against variants.';
comment on table public.coupons is 'Discount definitions.';
comment on table public.coupon_usage is 'Coupon redemption ledger.';
comment on table public.order_returns is 'RMA headers.';
comment on table public.return_items is 'RMA lines linked to original order_items.';
comment on table public.reviews is 'Product ratings and testimonials.';
comment on table public.audit_logs is 'Admin mutation audit trail.';

comment on column public.products.stock_quantity is 'Denormalized SUM(product_variants.stock_quantity), maintained by trigger.';
comment on column public.product_variants.stock_quantity is 'Canonical on-hand quantity for the sellable SKU.';
comment on column public.order_items.product_name is 'Snapshot at order time; survives catalog deletes.';
comment on column public.orders.channel is 'online = website; pos = store billing.';
