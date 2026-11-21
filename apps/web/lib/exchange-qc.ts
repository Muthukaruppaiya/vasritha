import type { QueryResultRow } from "pg";
import { query, queryOne } from "./db/pool";
import { ensureExchangePolicySchema } from "./exchange-policy";
import { ensureProductUnitsSchema, syncSellableStock } from "./product-units";

type Db = {
  query: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>;
  queryOne: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R | null>;
};

const poolDb: Db = { query, queryOne };

function looksLikePieceCode(sku: string | null | undefined) {
  const value = String(sku || "").trim().toUpperCase();
  return Boolean(value && /-\d{3,}$/.test(value));
}

/**
 * Put the original sold pieces into QC hold (status returned).
 * Reuses the same unit_code / barcode — never creates a new code when the sold piece exists.
 */
export async function holdExchangeStock(
  db: Db,
  input: { returnId: string; shopId: string | null }
) {
  const header = await db.queryOne<{ id: string; order_id: string }>(
    `select id, order_id from order_returns where id = $1`,
    [input.returnId]
  );
  if (!header) throw new Error("Exchange not found");

  const lines = await db.query<{
    product_id: string | null;
    variant_id: string | null;
    quantity: number;
    sku: string | null;
    family_sku: string | null;
    tag: string | null;
    product_name: string | null;
  }>(
    `select oi.product_id, oi.variant_id, ri.quantity, oi.sku,
            p.sku as family_sku, p.tag, oi.product_name
     from return_items ri
     join order_items oi on oi.id = ri.order_item_id
     left join products p on p.id = oi.product_id
     where ri.return_id = $1`,
    [input.returnId]
  );

  for (const line of lines) {
    if (!line.product_id || !line.variant_id) continue;
    const qty = Math.max(1, Math.trunc(Number(line.quantity) || 1));

    const tracked = await db.queryOne<{ c: number }>(
      input.shopId
        ? `select count(*)::int as c from product_items where variant_id = $1 and shop_id = $2`
        : `select count(*)::int as c from product_items where variant_id = $1`,
      input.shopId ? [line.variant_id, input.shopId] : [line.variant_id]
    );
    if (Number(tracked?.c || 0) <= 0) continue;

    const pieceCode = looksLikePieceCode(line.sku) ? String(line.sku).trim().toUpperCase() : "";
    const compact = pieceCode.replace(/[^A-Za-z0-9]/g, "");

    // 1) Prefer the exact barcode / unit code from the original bill line.
    let claimed = pieceCode
      ? await db.query<{ id: string }>(
          `with picked as (
             select i.id
             from product_items i
             where i.variant_id = $2
               and i.status = 'sold'
               and i.source_return_id is null
               and ($3::uuid is null or i.shop_id = $3)
               and (
                 upper(i.unit_code) = $4
                 or upper(replace(i.barcode, '-', '')) = $5
               )
             order by i.date_sold desc nulls last, i.seq asc
             limit $6
             for update
           )
           update product_items p
           set status = 'returned', source_return_id = $1
           from picked
           where p.id = picked.id
           returning p.id`,
          [input.returnId, line.variant_id, input.shopId, pieceCode, compact, qty]
        )
      : [];

    // 2) Otherwise take sold pieces from this same invoice (bill_id).
    if (claimed.length < qty) {
      const need = qty - claimed.length;
      const more = await db.query<{ id: string }>(
        `with picked as (
           select i.id
           from product_items i
           where i.variant_id = $2
             and i.status = 'sold'
             and i.source_return_id is null
             and i.bill_id = $3
             and ($4::uuid is null or i.shop_id = $4)
           order by i.date_sold desc nulls last, i.seq asc
           limit $5
           for update
         )
         update product_items p
         set status = 'returned', source_return_id = $1
         from picked
         where p.id = picked.id
         returning p.id`,
        [input.returnId, line.variant_id, header.order_id, input.shopId, need]
      );
      claimed = [...claimed, ...more];
    }

    // 3) Last resort: any sold piece of this variant at this shop (still same old codes).
    if (claimed.length < qty) {
      const need = qty - claimed.length;
      const more = await db.query<{ id: string }>(
        `with picked as (
           select i.id
           from product_items i
           where i.variant_id = $2
             and i.status = 'sold'
             and i.source_return_id is null
             and ($3::uuid is null or i.shop_id = $3)
           order by i.date_sold desc nulls last, i.seq asc
           limit $4
           for update
         )
         update product_items p
         set status = 'returned', source_return_id = $1
         from picked
         where p.id = picked.id
         returning p.id`,
        [input.returnId, line.variant_id, input.shopId, need]
      );
      claimed = [...claimed, ...more];
    }

    if (claimed.length < qty) {
      const name = line.product_name || line.family_sku || "item";
      throw new Error(
        `Could not find the original barcode for ${name}. Expected ${qty} sold piece(s); found ${claimed.length}.`
      );
    }
  }
}

/** Customer exchange marked received: hold the pieces and wait for QC on the history page. */
export async function receiveReturnForQc(returnId: string) {
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
  await holdExchangeStock(poolDb, {
    returnId,
    shopId: shop?.shop_id || null
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
      // Same barcode goes back on sale — clear the sold bill link.
      await query(
        `update product_items
         set status = 'to_sell',
             bill_id = null,
             date_sold = null,
             damage_detail = null
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
    const alreadyPosted = await exchangeStockAlreadyPosted(input.returnId);
    if (!alreadyPosted) await releaseUntrackedReturn(input.returnId, current.order_id);
  } else {
    const alreadyPosted = await exchangeStockAlreadyPosted(input.returnId);
    if (alreadyPosted) await reverseUntrackedReturn(input.returnId, current.order_id);
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

/**
 * Exchanges that already created a NEW barcode: pull those new codes off POS,
 * and put the original sold barcode into QC hold instead.
 */
export async function reopenLegacyExchangeQc() {
  await ensureExchangePolicySchema();
  await ensureProductUnitsSchema();
  const rows = await query<{ id: string; order_id: string; created_at: string; qc_status: string | null }>(
    `select id, order_id, created_at, qc_status
     from order_returns
     where status in ('exchanged', 'received')
       and (
         qc_status is null
         or qc_status = 'pending'
         or qc_status = 'approved'
       )
     order by created_at asc`
  );
  for (const row of rows) {
    const shop = await queryOne<{ shop_id: string | null }>(
      `select shop_id from orders where id = $1`,
      [row.order_id]
    );

    // Remove wrongly generated NEW pieces from this exchange (new codes).
    const bogus = await query<{ id: string; variant_id: string; shop_id: string | null }>(
      `select id, variant_id, shop_id
       from product_items
       where source_return_id = $1
         and status in ('returned', 'to_sell')
         and bill_id is null
         and date_added >= $2::timestamptz - interval '15 seconds'`,
      [row.id, row.created_at]
    );
    if (bogus.length) {
      await query(`delete from product_items where id = any($1::uuid[])`, [
        bogus.map((p) => p.id)
      ]);
      const seen = new Set<string>();
      for (const piece of bogus) {
        const key = `${piece.variant_id}:${piece.shop_id || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await syncSellableStock(poolDb, piece.variant_id, piece.shop_id);
      }
    }

    // Reclaim original sold barcodes into returned / to_sell based on QC.
    try {
      await holdExchangeStock(poolDb, {
        returnId: row.id,
        shopId: shop?.shop_id || null
      });
    } catch {
      /* older bills without piece tracking stay as untracked stock */
    }

    if (row.qc_status === "approved") {
      await query(
        `update product_items
         set status = 'to_sell', bill_id = null, date_sold = null, damage_detail = null
         where source_return_id = $1 and status = 'returned'`,
        [row.id]
      );
      const pieces = await query<{ variant_id: string; shop_id: string | null }>(
        `select variant_id, shop_id from product_items where source_return_id = $1`,
        [row.id]
      );
      const seen = new Set<string>();
      for (const piece of pieces) {
        const key = `${piece.variant_id}:${piece.shop_id || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await syncSellableStock(poolDb, piece.variant_id, piece.shop_id);
      }
    } else if (!row.qc_status) {
      await query(
        `update order_returns
         set qc_status = 'pending', updated_at = now()
         where id = $1 and qc_status is null`,
        [row.id]
      );
    }
  }
}

async function exchangeStockAlreadyPosted(returnId: string) {
  const row = await queryOne<{ id: string }>(
    `select id
     from inventory_movements
     where reference_id = $1
       and reference_type = 'exchange'
       and type = 'return'
     limit 1`,
    [returnId]
  );
  return Boolean(row);
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

async function reverseUntrackedReturn(returnId: string, orderId: string) {
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
        `update shop_variant_stock
         set stock_quantity = greatest(0, stock_quantity - $3), updated_at = now()
         where shop_id = $1 and variant_id = $2`,
        [shop.shop_id, line.variant_id, qty]
      );
    }
    await query(
      `update product_variants
       set stock_quantity = greatest(0, stock_quantity - $2)
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
