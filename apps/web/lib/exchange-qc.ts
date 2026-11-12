import type { QueryResultRow } from "pg";
import { query, queryOne } from "./db/pool";
import { ensureExchangePolicySchema } from "./exchange-policy";
import {
  createProductUnits,
  ensureProductUnitsSchema,
  syncSellableStock
} from "./product-units";

type Db = {
  query: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>;
  queryOne: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R | null>;
};

const poolDb: Db = { query, queryOne };

export type ExchangeHoldLine = {
  productId: string;
  variantId: string;
  quantity: number;
  sku: string;
  tag?: string | null;
};

/** Park exchanged pieces as returned. They stay off the POS list until QC approves. */
export async function holdExchangeStock(
  db: Db,
  input: { returnId: string; shopId: string | null; lines: ExchangeHoldLine[] }
) {
  // Caller must ensure the schema first. Running ALTER here uses a second
  // connection and stalls the open checkout transaction until Postgres kills it.
  for (const line of input.lines) {
    if (!line.productId || !line.variantId) continue;
    const qty = Math.max(1, Math.trunc(Number(line.quantity) || 1));
    const tracked = await db.queryOne<{ c: number }>(
      input.shopId
        ? `select count(*)::int as c from product_items where variant_id = $1 and shop_id = $2`
        : `select count(*)::int as c from product_items where variant_id = $1`,
      input.shopId ? [line.variantId, input.shopId] : [line.variantId]
    );
    if (Number(tracked?.c || 0) <= 0) continue;
    const familySku = line.sku || "EXC";
    await createProductUnits(db, {
      productId: line.productId,
      variantId: line.variantId,
      tag: line.tag || familySku,
      sku: familySku,
      count: qty,
      shopId: input.shopId,
      status: "returned",
      sourceReturnId: input.returnId
    });
  }
}

/** Customer exchange marked received: hold the pieces and wait for QC on the history page. */
export async function queueReturnForQc(returnId: string) {
  await ensureExchangePolicySchema();
  await ensureProductUnitsSchema();
  const header = await queryOne<{ id: string; order_id: string; qc_status: string | null }>(
    `select id, order_id, qc_status from order_returns where id = $1`,
    [returnId]
  );
  if (!header || header.qc_status === "pending" || header.qc_status === "approved" || header.qc_status === "damaged") {
    return;
  }
  const shop = await queryOne<{ shop_id: string | null }>(
    `select shop_id from orders where id = $1`,
    [header.order_id]
  );
  const lines = await query<{
    product_id: string | null;
    variant_id: string | null;
    quantity: number;
    sku: string | null;
    tag: string | null;
    family_sku: string | null;
  }>(
    `select oi.product_id, oi.variant_id, ri.quantity, oi.sku, p.tag, p.sku as family_sku
     from return_items ri
     join order_items oi on oi.id = ri.order_item_id
     left join products p on p.id = oi.product_id
     where ri.return_id = $1`,
    [returnId]
  );
  await holdExchangeStock(poolDb, {
    returnId,
    shopId: shop?.shop_id || null,
    lines: lines
      .filter((line): line is typeof line & { product_id: string; variant_id: string } =>
        Boolean(line.product_id && line.variant_id)
      )
      .map((line) => {
        const familySku = line.family_sku || line.sku || "EXC";
        return {
          productId: line.product_id,
          variantId: line.variant_id,
          quantity: Number(line.quantity) || 1,
          sku: familySku,
          tag: line.tag || familySku
        };
      })
  });
  await query(
    `update order_returns set qc_status = 'pending', updated_at = now() where id = $1 and qc_status is null`,
    [returnId]
  );
}

export async function decideExchangeQc(input: {
  returnId: string;
  decision: "approve" | "damage";
  userId: string;
}) {
  await ensureExchangePolicySchema();
  await ensureProductUnitsSchema();

  const current = await queryOne<{ id: string; qc_status: string | null; order_id: string }>(
    `select id, qc_status, order_id from order_returns where id = $1`,
    [input.returnId]
  );
  if (!current) throw new Error("Exchange not found");
  if (current.qc_status !== "pending") {
    throw new Error("This exchange is not waiting for a QC check");
  }

  const next = input.decision === "approve" ? "approved" : "damaged";
  const claimed = await queryOne<{ id: string }>(
    `update order_returns
     set qc_status = $2, updated_at = now()
     where id = $1 and qc_status = 'pending'
     returning id`,
    [input.returnId, next]
  );
  if (!claimed) throw new Error("This exchange was already checked");

  const pieces = await query<{ variant_id: string; shop_id: string | null }>(
    `select variant_id, shop_id
     from product_items
     where source_return_id = $1 and status = 'returned'`,
    [input.returnId]
  );

  if (pieces.length) {
    if (input.decision === "approve") {
      await query(
        `update product_items
         set status = 'to_sell'
         where source_return_id = $1 and status = 'returned'`,
        [input.returnId]
      );
    } else {
      await query(
        `update product_items
         set status = 'damaged', damage_detail = $2
         where source_return_id = $1 and status = 'returned'`,
        [input.returnId, "Failed exchange QC"]
      );
    }
    const seen = new Set<string>();
    for (const piece of pieces) {
      const key = `${piece.variant_id}:${piece.shop_id || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await syncSellableStock(poolDb, piece.variant_id, piece.shop_id);
    }
  } else if (input.decision === "approve") {
    await releaseUntrackedReturn(input.returnId, current.order_id);
  }

  const shop = await queryOne<{ shop_id: string | null }>(
    `select shop_id from orders where id = $1`,
    [current.order_id]
  );
  if (input.decision === "approve") {
    await query(
      `insert into inventory_movements
         (product_variant_id, type, quantity, reference_type, reference_id, note, created_by, shop_id)
       select oi.variant_id, 'return', ri.quantity, 'exchange', $1,
              'QC approved · back on sale', $2, $3
       from return_items ri
       join order_items oi on oi.id = ri.order_item_id
       where ri.return_id = $1 and oi.variant_id is not null`,
      [input.returnId, input.userId, shop?.shop_id || null]
    ).catch(() => undefined);
  }

  return { id: input.returnId, qc_status: next };
}

async function releaseUntrackedReturn(returnId: string, orderId: string) {
  const shop = await queryOne<{ shop_id: string | null }>(
    `select shop_id from orders where id = $1`,
    [orderId]
  );
  const lines = await query<{ variant_id: string; quantity: number }>(
    `select oi.variant_id, ri.quantity
     from return_items ri
     join order_items oi on oi.id = ri.order_item_id
     where ri.return_id = $1 and oi.variant_id is not null`,
    [returnId]
  );
  for (const line of lines) {
    const qty = Math.max(1, Math.trunc(Number(line.quantity) || 1));
    if (shop?.shop_id) {
      await query(
        `insert into shop_variant_stock (shop_id, variant_id, stock_quantity, updated_at)
         values ($1, $2, $3, now())
         on conflict (shop_id, variant_id) do update
           set stock_quantity = shop_variant_stock.stock_quantity + excluded.stock_quantity,
               updated_at = now()`,
        [shop.shop_id, line.variant_id, qty]
      );
    }
    await query(
      `update product_variants
       set stock_quantity = stock_quantity + $2
       where id = $1`,
      [line.variant_id, qty]
    );
    await query(
      `update products p
       set stock_quantity = coalesce((
         select sum(pv.stock_quantity)::int from product_variants pv where pv.product_id = p.id
       ), 0),
       updated_at = now()
       where id = (select product_id from product_variants where id = $1)`,
      [line.variant_id]
    );
  }
}
