import { query, queryOne } from "./db/pool";

export type ShopRow = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  state: string | null;
  state_code: string | null;
  gstin: string | null;
  brand_id: string | null;
  is_active: boolean;
  is_default: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function ensureShopsSchema() {
  await query(`
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
    )
  `);
  await query(`
    create unique index if not exists shops_code_unique_idx
      on public.shops (lower(code))
  `);
  await query(`
    create unique index if not exists shops_one_default_idx
      on public.shops ((1))
      where is_default
  `);
  await query(`
    alter table public.orders
      add column if not exists shop_id uuid references public.shops(id)
  `);
  await query(`
    alter table public.inventory_movements
      add column if not exists shop_id uuid references public.shops(id)
  `);
  await query(`
    alter table public.product_items
      add column if not exists shop_id uuid references public.shops(id)
  `);
  await query(`
    create index if not exists orders_shop_id_idx
      on public.orders (shop_id)
      where shop_id is not null
  `);
  await query(`
    create index if not exists inventory_movements_shop_id_idx
      on public.inventory_movements (shop_id)
      where shop_id is not null
  `);
  await query(`
    create index if not exists product_items_shop_id_idx
      on public.product_items (shop_id)
      where shop_id is not null
  `);

  const count = await queryOne<{ c: number }>(`select count(*)::int as c from public.shops`);
  if (!Number(count?.c || 0)) {
    await query(`
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
      limit 1
    `);
    // If site_settings missing, still ensure one shop
    const again = await queryOne<{ c: number }>(`select count(*)::int as c from public.shops`);
    if (!Number(again?.c || 0)) {
      await query(`
        insert into public.shops (code, name, is_active, is_default)
        values ('MAIN', 'Main Store', true, true)
      `);
    }
  }
}

export function normalizeShopCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 24);
}

export async function listShops(options?: { activeOnly?: boolean }) {
  await ensureShopsSchema();
  if (options?.activeOnly) {
    return query<ShopRow>(
      `select * from shops where is_active = true order by is_default desc, name asc`
    );
  }
  return query<ShopRow>(`select * from shops order by is_default desc, name asc`);
}

export async function getDefaultShop() {
  await ensureShopsSchema();
  const preferred = await queryOne<ShopRow>(
    `select * from shops where is_default = true and is_active = true limit 1`
  );
  if (preferred) return preferred;
  return queryOne<ShopRow>(
    `select * from shops where is_active = true order by created_at asc limit 1`
  );
}

export async function getShopById(id: string) {
  await ensureShopsSchema();
  return queryOne<ShopRow>(`select * from shops where id = $1`, [id]);
}

export async function resolveShopId(preferredId?: string | null) {
  if (preferredId) {
    const shop = await getShopById(preferredId);
    if (shop?.is_active) return shop.id;
  }
  const fallback = await getDefaultShop();
  return fallback?.id ?? null;
}

/** Clear other defaults then set this shop as default. */
export async function setDefaultShop(shopId: string) {
  await query(`update shops set is_default = false where is_default = true and id <> $1`, [shopId]);
  await query(`update shops set is_default = true, updated_at = now() where id = $1`, [shopId]);
}
