import { query, queryOne } from "./db/pool";
import { DEFAULT_BRAND_CODE, OPS_PLATFORM_NAME } from "./platform";

export { DEFAULT_BRAND_CODE, OPS_PLATFORM_NAME };
export type BrandRow = {
  id: string;
  code: string;
  name: string;
  slug: string;
  tagline: string | null;
  logo_path: string | null;
  support_email: string | null;
  support_phone: string | null;
  website_url: string | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function ensureBrandsSchema() {
  await query(`
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
    )
  `);
  await query(`
    create unique index if not exists brands_code_unique_idx
      on public.brands (lower(code))
  `);
  await query(`
    create unique index if not exists brands_slug_unique_idx
      on public.brands (lower(slug))
  `);
  await query(`
    create unique index if not exists brands_one_default_idx
      on public.brands ((1))
      where is_default
  `);
  await query(`
    alter table public.products
      add column if not exists brand_id uuid references public.brands(id)
  `);
  await query(`
    alter table public.orders
      add column if not exists brand_id uuid references public.brands(id)
  `);
  await query(`
    alter table public.site_settings
      add column if not exists default_brand_id uuid references public.brands(id)
  `);
  await query(`
    alter table public.shops
      add column if not exists brand_id uuid references public.brands(id)
  `);
  await query(`
    create index if not exists products_brand_id_idx
      on public.products (brand_id)
      where brand_id is not null
  `);
  await query(`
    create index if not exists orders_brand_id_idx
      on public.orders (brand_id)
      where brand_id is not null
  `);

  const count = await queryOne<{ c: number }>(`select count(*)::int as c from public.brands`);
  if (!Number(count?.c || 0)) {
    await query(`
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
      limit 1
    `);
    const again = await queryOne<{ c: number }>(`select count(*)::int as c from public.brands`);
    if (!Number(again?.c || 0)) {
      await query(`
        insert into public.brands (code, name, slug, tagline, is_active, is_default, sort_order)
        values ('VASRITHA', 'Vasritha', 'vasritha', 'Timeless Elegance', true, true, 0)
      `);
    }
  }

  // Soft backfill null brand_ids to the default brand (idempotent)
  await query(`
    update public.products p
    set brand_id = d.id
    from public.brands d
    where d.is_default and p.brand_id is null
  `);
  await query(`
    update public.orders o
    set brand_id = d.id
    from public.brands d
    where d.is_default and o.brand_id is null
  `);
  await query(`
    update public.shops s
    set brand_id = d.id
    from public.brands d
    where d.is_default and s.brand_id is null
  `);
  await query(`
    update public.site_settings ss
    set default_brand_id = d.id
    from public.brands d
    where d.is_default and ss.default_brand_id is null
  `);
}

export function normalizeBrandCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);
}

export function slugifyBrand(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export async function listBrands(options?: { activeOnly?: boolean }) {
  await ensureBrandsSchema();
  if (options?.activeOnly) {
    return query<BrandRow>(
      `select * from brands where is_active = true order by sort_order asc, name asc`
    );
  }
  return query<BrandRow>(`select * from brands order by is_default desc, sort_order asc, name asc`);
}

export async function getDefaultBrand() {
  await ensureBrandsSchema();
  const preferred = await queryOne<BrandRow>(
    `select * from brands where is_default = true and is_active = true limit 1`
  );
  if (preferred) return preferred;
  return queryOne<BrandRow>(
    `select * from brands where is_active = true order by sort_order asc, created_at asc limit 1`
  );
}

export async function getBrandById(id: string) {
  await ensureBrandsSchema();
  return queryOne<BrandRow>(`select * from brands where id = $1`, [id]);
}

export async function getBrandByCode(code: string) {
  await ensureBrandsSchema();
  return queryOne<BrandRow>(`select * from brands where lower(code) = lower($1)`, [code]);
}

export async function resolveBrandId(preferredId?: string | null) {
  if (preferredId) {
    const brand = await getBrandById(preferredId);
    if (brand?.is_active) return brand.id;
  }
  const fallback = await getDefaultBrand();
  return fallback?.id ?? null;
}

export async function setDefaultBrand(brandId: string) {
  await query(`update brands set is_default = false where is_default = true and id <> $1`, [brandId]);
  await query(`update brands set is_default = true, updated_at = now() where id = $1`, [brandId]);
  await query(`update site_settings set default_brand_id = $1, updated_at = now()`, [brandId]);
}
