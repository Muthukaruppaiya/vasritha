import type { QueryResultRow } from "pg";
import { query, queryOne, withTransaction } from "./db/pool";

export type UnitStatus = "to_sell" | "sold" | "returned" | "damaged";
export type LabelSize = "accessory" | "dress";

export type ProductItem = {
  id: string;
  product_id: string;
  variant_id: string;
  tag: string;
  seq: number;
  unit_code: string;
  barcode: string;
  status: UnitStatus;
  damage_detail: string | null;
  date_added: string;
  date_sold: string | null;
  bill_id: string | null;
  label_printed: boolean;
};

type Db = {
  query: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>;
  queryOne: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R | null>;
};

export function compactBarcodeBase(sku: string) {
  const compact = sku.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return (compact.slice(0, 12) || "VAS").toUpperCase();
}

export async function ensureProductUnitsSchema() {
  await query(`
    do $$ begin
      create type public.product_item_status as enum ('to_sell','sold','returned','damaged');
    exception when duplicate_object then null;
    end $$;
  `);
  await query(`
    do $$ begin
      create type public.product_label_size as enum ('accessory','dress');
    exception when duplicate_object then null;
    end $$;
  `);
  await query(`
    alter table public.products
      add column if not exists tag text,
      add column if not exists sku_prefix text not null default 'VAS',
      add column if not exists label_size public.product_label_size not null default 'dress',
      add column if not exists image_upload_token uuid not null default gen_random_uuid(),
      add column if not exists parent_product_id uuid
  `);
  await query(`
    do $$ begin
      alter table public.products
        add constraint products_parent_product_id_fkey
        foreign key (parent_product_id) references public.products(id) on delete set null;
    exception when duplicate_object then null;
    end $$;
  `);
  await query(`
    do $$ begin
      alter table public.products
        add constraint products_parent_not_self
        check (parent_product_id is null or parent_product_id <> id);
    exception when duplicate_object then null;
    end $$;
  `);
  await query(`
    create index if not exists products_parent_product_id_idx
      on public.products (parent_product_id)
      where parent_product_id is not null
  `);
  await query(`
    create unique index if not exists products_image_upload_token_idx
      on public.products (image_upload_token)
  `);
  await query(`
    do $$ begin
      create type public.product_image_kind as enum ('website', 'internal');
    exception when duplicate_object then null;
    end $$;
  `);
  await query(`
    alter table public.product_images
      add column if not exists image_kind public.product_image_kind not null default 'website'
  `);
  await query(`
    create index if not exists product_images_product_kind_idx
      on public.product_images (product_id, image_kind, sort_order)
  `);
  await query(`
    create table if not exists public.product_items (
      id uuid primary key default gen_random_uuid(),
      product_id uuid not null references public.products(id) on delete cascade,
      variant_id uuid not null references public.product_variants(id) on delete cascade,
      tag text not null,
      seq integer not null,
      unit_code text not null unique,
      barcode text not null unique,
      status public.product_item_status not null default 'to_sell',
      damage_detail text,
      date_added timestamptz not null default now(),
      date_sold timestamptz,
      bill_id uuid references public.orders(id) on delete set null,
      label_printed boolean not null default false,
      unique (product_id, seq)
    )
  `);
  await query(`
    create table if not exists public.product_price_history (
      id uuid primary key default gen_random_uuid(),
      product_id uuid not null references public.products(id) on delete cascade,
      price numeric(12,2) not null,
      recorded_at timestamptz not null default now()
    )
  `);
}

export async function createProductUnits(
  db: Db,
  input: {
    productId: string;
    variantId: string;
    tag: string;
    sku: string;
    count: number;
  }
) {
  const count = Math.max(0, Math.trunc(input.count));
  if (!count) return [] as ProductItem[];

  const maxRow = await db.queryOne<{ max: number }>(
    `select coalesce(max(seq), 0)::int as max from product_items where product_id = $1`,
    [input.productId]
  );
  let seq = Number(maxRow?.max || 0);
  const compact = compactBarcodeBase(input.sku);
  const tag = (input.tag || input.sku).trim().toUpperCase();
  const created: ProductItem[] = [];

  for (let i = 0; i < count; i += 1) {
    seq += 1;
    const padded = String(seq).padStart(4, "0");
    const unitCode = `${input.sku}-${padded}`.toUpperCase();
    const barcode = `${compact}${padded}`;
    const row = await db.queryOne<ProductItem>(
      `insert into product_items
         (product_id, variant_id, tag, seq, unit_code, barcode, status)
       values ($1, $2, $3, $4, $5, $6, 'to_sell')
       returning *`,
      [input.productId, input.variantId, tag, seq, unitCode, barcode]
    );
    if (row) created.push(row);
  }

  return created;
}

export async function syncSellableStock(db: Db, variantId: string) {
  await db.query(
    `update product_variants
     set stock_quantity = (
       select count(*)::int from product_items
       where variant_id = $1 and status = 'to_sell'
     )
     where id = $1`,
    [variantId]
  );
}

export async function recordPriceHistory(productId: string, price: number) {
  await query(
    `insert into product_price_history (product_id, price) values ($1, $2)`,
    [productId, price]
  );
}

export async function listProductItems(productId: string) {
  return query<ProductItem>(
    `select * from product_items where product_id = $1 order by seq asc`,
    [productId]
  );
}

export async function markItemsSold(db: Db, itemIds: string[], orderId: string, variantId?: string) {
  if (!itemIds.length) return;
  if (variantId) {
    await db.query(
      `update product_items
       set status = 'sold', date_sold = now(), bill_id = $2
       where id = any($1::uuid[])
         and variant_id = $3
         and status = 'to_sell'`,
      [itemIds, orderId, variantId]
    );
    return;
  }
  await db.query(
    `update product_items
     set status = 'sold', date_sold = now(), bill_id = $2
     where id = any($1::uuid[])
       and status = 'to_sell'`,
    [itemIds, orderId]
  );
}

export async function allocateSellableItems(
  db: Db,
  variantId: string,
  quantity: number
) {
  return db.query<ProductItem>(
    `select * from product_items
     where variant_id = $1 and status = 'to_sell'
     order by seq asc
     limit $2
     for update`,
    [variantId, quantity]
  );
}

export async function lookupUnitByCode(code: string) {
  const exact = code.trim().toUpperCase();
  return queryOne<{
    item_id: string;
    product_id: string;
    variant_id: string;
    name: string;
    unit_code: string;
    barcode: string;
    tag: string;
    price: string;
    image_path: string | null;
  }>(
    `select
       i.id as item_id,
       i.product_id,
       i.variant_id,
       p.name,
       i.unit_code,
       i.barcode,
       i.tag,
       coalesce(pv.price, p.price) as price,
       (
         select pi.storage_path from product_images pi
         where pi.product_id = p.id
           and coalesce(pi.image_kind::text, 'website') = 'website'
         order by pi.sort_order asc
         limit 1
       ) as image_path
     from product_items i
     join products p on p.id = i.product_id
     join product_variants pv on pv.id = i.variant_id
     where i.status = 'to_sell'
       and p.status = 'active'
       and (upper(i.barcode) = $1 or upper(i.unit_code) = $1)
     limit 1`,
    [exact]
  );
}

export async function createUnitsAndSync(input: {
  productId: string;
  variantId: string;
  tag: string;
  sku: string;
  count: number;
}) {
  return withTransaction(async (db) => {
    const items = await createProductUnits(db, input);
    await syncSellableStock(db, input.variantId);
    return items;
  });
}

