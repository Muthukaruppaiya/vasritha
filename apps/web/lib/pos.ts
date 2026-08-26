import { query, queryOne } from "./db/pool";
import { lookupUnitByCode } from "./product-units";

export const WALK_IN_EMAIL = "pos@vasritha.local";
export const WALK_IN_NAME = "Walk-in Customer";

export async function ensurePosSchema() {
  await query(`
    alter table public.orders
      add column if not exists discount_amount numeric(12,2) not null default 0
  `);
  await query(`
    alter table public.orders
      add column if not exists channel text not null default 'online'
  `);
  await query(`
    alter table public.orders
      add column if not exists pos_customer_name text
  `);
  await query(`
    alter table public.orders
      add column if not exists pos_customer_phone text
  `);
  await query(`
    alter table public.orders
      add column if not exists pos_customer_email text
  `);
}

/** Normalize Indian mobile: digits only, strip leading 91 if 12 digits. */
export function normalizePosPhone(raw: string) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function validatePosCustomer(input: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  const name = String(input.name || "").trim();
  const phone = normalizePosPhone(String(input.phone || ""));
  const emailRaw = String(input.email || "").trim();
  const email = emailRaw || null;

  if (!name) return { error: "Customer name is required" as const };
  if (name.length < 2) return { error: "Enter a valid customer name" as const };
  if (!phone || phone.length !== 10) {
    return { error: "Enter a valid 10-digit mobile number" as const };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address" as const };
  }

  return { name, phone, email };
}

export async function getWalkInCustomerId() {
  const existing = await queryOne<{ id: string }>(
    `select id from customers where email = $1`,
    [WALK_IN_EMAIL]
  );
  if (existing) return existing.id;

  const user = await queryOne<{ id: string }>(
    `select id from users where email = $1`,
    [WALK_IN_EMAIL]
  );
  if (user) {
    await query(
      `insert into customers (id, full_name, email, phone)
       values ($1, $2, $3, null)
       on conflict (id) do nothing`,
      [user.id, WALK_IN_NAME, WALK_IN_EMAIL]
    );
    return user.id;
  }

  throw new Error(
    "Walk-in customer missing. Run: npm run db:patch:pos"
  );
}

export type PosSellable = {
  productId: string;
  variantId: string | null;
  itemId?: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  variantName: string | null;
  price: number;
  stock: number;
  imageSrc: string | null;
};

export async function lookupSellable(q: string): Promise<PosSellable[]> {
  const term = q.trim();
  if (!term) return [];

  const exact = term.toUpperCase();
  const like = `%${term}%`;

  const unit = await lookupUnitByCode(exact).catch(() => null);
  if (unit) {
    return [
      {
        productId: unit.product_id,
        variantId: unit.variant_id,
        itemId: unit.item_id,
        name: unit.name,
        sku: unit.unit_code,
        barcode: unit.barcode,
        variantName: unit.tag,
        price: Number(unit.price),
        stock: 1,
        imageSrc: unit.image_path
      }
    ];
  }

  // Prefer exact barcode / SKU matches first.
  const exactRows = await query<{
    product_id: string;
    variant_id: string | null;
    name: string;
    product_sku: string | null;
    product_barcode: string | null;
    variant_name: string | null;
    variant_sku: string | null;
    variant_barcode: string | null;
    product_price: string;
    variant_price: string | null;
    product_stock: number;
    variant_stock: number | null;
    image_path: string | null;
  }>(
    `select
       p.id as product_id,
       pv.id as variant_id,
       p.name,
       p.sku as product_sku,
       p.barcode as product_barcode,
       pv.name as variant_name,
       pv.sku as variant_sku,
       pv.barcode as variant_barcode,
       p.price as product_price,
       pv.price as variant_price,
       p.stock_quantity as product_stock,
       pv.stock_quantity as variant_stock,
       (
         select pi.storage_path from product_images pi
         where pi.product_id = p.id
           and coalesce(pi.image_kind::text, 'website') = 'website'
         order by pi.sort_order asc
         limit 1
       ) as image_path
     from products p
     left join product_variants pv on pv.product_id = p.id
     where p.status = 'active'
       and (
         upper(coalesce(p.barcode, '')) = $1
         or upper(coalesce(p.sku, '')) = $1
         or upper(coalesce(pv.barcode, '')) = $1
         or upper(coalesce(pv.sku, '')) = $1
       )
     order by p.name asc, pv.name asc nulls first
     limit 20`,
    [exact]
  );

  if (exactRows.length) {
    return exactRows.map(mapSellable);
  }

  const fuzzy = await query<{
    product_id: string;
    variant_id: string | null;
    name: string;
    product_sku: string | null;
    product_barcode: string | null;
    variant_name: string | null;
    variant_sku: string | null;
    variant_barcode: string | null;
    product_price: string;
    variant_price: string | null;
    product_stock: number;
    variant_stock: number | null;
    image_path: string | null;
  }>(
    `select
       p.id as product_id,
       pv.id as variant_id,
       p.name,
       p.sku as product_sku,
       p.barcode as product_barcode,
       pv.name as variant_name,
       pv.sku as variant_sku,
       pv.barcode as variant_barcode,
       p.price as product_price,
       pv.price as variant_price,
       p.stock_quantity as product_stock,
       pv.stock_quantity as variant_stock,
       (
         select pi.storage_path from product_images pi
         where pi.product_id = p.id
           and coalesce(pi.image_kind::text, 'website') = 'website'
         order by pi.sort_order asc
         limit 1
       ) as image_path
     from products p
     left join product_variants pv on pv.product_id = p.id
     where p.status = 'active'
       and (
         p.name ilike $1
         or coalesce(p.sku, '') ilike $1
         or coalesce(p.barcode, '') ilike $1
         or coalesce(pv.sku, '') ilike $1
         or coalesce(pv.barcode, '') ilike $1
         or coalesce(pv.name, '') ilike $1
       )
     order by p.name asc, pv.name asc nulls first
     limit 20`,
    [like]
  );

  return fuzzy.map(mapSellable);
}

function mapSellable(row: {
  product_id: string;
  variant_id: string | null;
  name: string;
  product_sku: string | null;
  product_barcode: string | null;
  variant_name: string | null;
  variant_sku: string | null;
  variant_barcode: string | null;
  product_price: string;
  variant_price: string | null;
  product_stock: number;
  variant_stock: number | null;
  image_path: string | null;
}): PosSellable {
  const hasVariant = Boolean(row.variant_id);
  return {
    productId: row.product_id,
    variantId: row.variant_id,
    itemId: null,
    name: row.name,
    sku: hasVariant ? row.variant_sku || row.product_sku : row.product_sku,
    barcode: hasVariant ? row.variant_barcode || row.product_barcode : row.product_barcode,
    variantName: row.variant_name,
    price: Number(hasVariant && row.variant_price != null ? row.variant_price : row.product_price),
    stock: Number(
      hasVariant && row.variant_stock != null ? row.variant_stock : row.product_stock
    ),
    imageSrc: row.image_path
  };
}
