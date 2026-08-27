import type { QueryResultRow } from "pg";
import { query, queryOne, withTransaction } from "./db/pool";
import { ensureProductUnitsSchema, syncSellableStock } from "./product-units";

export const CART_HOLD_MINUTES = 30;

type Db = {
  query: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>;
  queryOne: <R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<R | null>;
};

export type StockReservation = {
  id: string;
  session_key: string;
  customer_id: string | null;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  product_item_id: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export async function ensureCartReservationsSchema() {
  await ensureProductUnitsSchema();

  await query(`
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
  `);

  await query(`
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
    )
  `);

  await query(`
    create index if not exists stock_reservations_session_idx
      on public.stock_reservations (session_key, expires_at)
  `);
  await query(`
    create index if not exists stock_reservations_customer_idx
      on public.stock_reservations (customer_id, expires_at)
      where customer_id is not null
  `);
  await query(`
    create index if not exists stock_reservations_variant_active_idx
      on public.stock_reservations (variant_id, expires_at)
      where variant_id is not null
  `);
  await query(`
    create index if not exists stock_reservations_expires_idx
      on public.stock_reservations (expires_at)
  `);
  await query(`
    create unique index if not exists stock_reservations_item_active_uidx
      on public.stock_reservations (product_item_id)
      where product_item_id is not null
  `);
  await query(`
    alter table public.cart_items
      add column if not exists reserved_until timestamptz,
      add column if not exists session_key text
  `);
}

function holdExpiry() {
  return new Date(Date.now() + CART_HOLD_MINUTES * 60 * 1000);
}

/** Release expired holds; restore unique pieces to to_sell and refresh variant qty. */
export async function releaseExpiredReservations(db?: Db) {
  const run = async (client: Db) => {
    const expired = await client.query<{
      id: string;
      variant_id: string | null;
      product_item_id: string | null;
    }>(
      `select id, variant_id, product_item_id
       from stock_reservations
       where expires_at <= now()
       for update skip locked`
    );

    if (!expired.length) return 0;

    const itemIds = expired
      .map((row) => row.product_item_id)
      .filter((id): id is string => Boolean(id));
    const variantIds = [
      ...new Set(expired.map((row) => row.variant_id).filter((id): id is string => Boolean(id)))
    ];

    if (itemIds.length) {
      await client.query(
        `update product_items
         set status = 'to_sell'
         where id = any($1::uuid[])
           and status = 'reserved'`,
        [itemIds]
      );
    }

    await client.query(`delete from stock_reservations where id = any($1::uuid[])`, [
      expired.map((row) => row.id)
    ]);

    for (const variantId of variantIds) {
      const hasUnits = await client.queryOne<{ c: number }>(
        `select count(*)::int as c from product_items where variant_id = $1`,
        [variantId]
      );
      if (Number(hasUnits?.c || 0) > 0) {
        await syncSellableStock(client, variantId);
      }
    }

    return expired.length;
  };

  if (db) return run(db);
  return withTransaction(async (tx) => run(tx));
}

/** Units this session can still buy now (free stock + already held by session). */
export async function getPurchasableStock(
  productId: string,
  variantId: string | null,
  sessionKey?: string | null
): Promise<number> {
  await ensureCartReservationsSchema();
  await releaseExpiredReservations();

  let resolvedVariantId = variantId;
  if (!resolvedVariantId) {
    const first = await queryOne<{ id: string }>(
      `select id from product_variants where product_id = $1 order by name asc limit 1`,
      [productId]
    );
    resolvedVariantId = first?.id || null;
  }
  if (!resolvedVariantId) return 0;

  const free = await getAvailableStock(productId, resolvedVariantId, sessionKey || null);
  if (!sessionKey) return free;

  const own = await queryOne<{ qty: string }>(
    `select coalesce(sum(quantity), 0)::text as qty
     from stock_reservations
     where session_key = $1
       and variant_id = $2
       and expires_at > now()`,
    [sessionKey, resolvedVariantId]
  );
  return free + Number(own?.qty || 0);
}

/** Sellable units for others: to_sell pieces, or stock_quantity minus active qty holds. */
export async function getAvailableStock(
  productId: string,
  variantId: string | null,
  excludeSessionKey?: string | null
): Promise<number> {
  await ensureCartReservationsSchema();
  await releaseExpiredReservations();

  let resolvedVariantId = variantId;
  if (!resolvedVariantId) {
    const first = await queryOne<{ id: string }>(
      `select id from product_variants where product_id = $1 order by name asc limit 1`,
      [productId]
    );
    resolvedVariantId = first?.id || null;
  }

  if (!resolvedVariantId) {
    const product = await queryOne<{ stock_quantity: number }>(
      `select stock_quantity from products where id = $1`,
      [productId]
    );
    return Math.max(0, Number(product?.stock_quantity || 0));
  }

  const unitCount = await queryOne<{ c: number }>(
    `select count(*)::int as c from product_items where variant_id = $1`,
    [resolvedVariantId]
  );

  if (Number(unitCount?.c || 0) > 0) {
    const sellable = await queryOne<{ c: number }>(
      `select count(*)::int as c from product_items
       where variant_id = $1 and status = 'to_sell'`,
      [resolvedVariantId]
    );
    return Math.max(0, Number(sellable?.c || 0));
  }

  const variant = await queryOne<{ stock_quantity: number }>(
    `select stock_quantity from product_variants where id = $1`,
    [resolvedVariantId]
  );
  const onHand = Math.max(0, Number(variant?.stock_quantity || 0));

  const held = await queryOne<{ qty: string }>(
    `select coalesce(sum(quantity), 0)::text as qty
     from stock_reservations
     where variant_id = $1
       and expires_at > now()
       and product_item_id is null
       and ($2::text is null or session_key <> $2)`,
    [resolvedVariantId, excludeSessionKey || null]
  );

  return Math.max(0, onHand - Number(held?.qty || 0));
}

/**
 * Set absolute reserved quantity for a session line (product+variant).
 * Creates/releases unique piece holds or qty holds as needed.
 */
export async function setReservationQuantity(input: {
  sessionKey: string;
  customerId?: string | null;
  productId: string;
  variantId?: string | null;
  quantity: number;
  /** When true and qty unchanged, push expires_at forward by 30 minutes */
  extendTtl?: boolean;
}): Promise<{ reservedUntil: string | null; quantity: number; available: number }> {
  await ensureCartReservationsSchema();

  const sessionKey = String(input.sessionKey || "").trim();
  if (!sessionKey) throw new Error("sessionKey is required");

  const quantity = Math.max(0, Math.trunc(Number(input.quantity) || 0));

  return withTransaction(async (db) => {
    await releaseExpiredReservations(db);

    let variantId = input.variantId || null;
    if (!variantId) {
      const first = await db.queryOne<{ id: string }>(
        `select id from product_variants where product_id = $1 order by name asc limit 1`,
        [input.productId]
      );
      variantId = first?.id || null;
    }
    if (!variantId) throw new Error("Product has no sellable variant");

    const existing = await db.query<StockReservation>(
      `select * from stock_reservations
       where session_key = $1
         and product_id = $2
         and variant_id is not distinct from $3
         and expires_at > now()
       for update`,
      [sessionKey, input.productId, variantId]
    );

    const currentQty = existing.reduce((sum, row) => sum + Number(row.quantity), 0);

    if (quantity === 0) {
      await releaseSessionLine(db, existing);
      return { reservedUntil: null, quantity: 0, available: await availableInTx(db, variantId, sessionKey) };
    }

    if (quantity === currentQty) {
      if (input.extendTtl) {
        const expires = holdExpiry();
        await db.query(
          `update stock_reservations
           set expires_at = $2, updated_at = now(),
               customer_id = coalesce($3::uuid, customer_id)
           where session_key = $1
             and product_id = $4
             and variant_id is not distinct from $5
             and expires_at > now()`,
          [sessionKey, expires.toISOString(), input.customerId || null, input.productId, variantId]
        );
        return {
          reservedUntil: expires.toISOString(),
          quantity,
          available: await availableInTx(db, variantId, sessionKey)
        };
      }
      const soonest = existing.reduce(
        (min, row) => (row.expires_at < min ? row.expires_at : min),
        existing[0].expires_at
      );
      return {
        reservedUntil: soonest,
        quantity,
        available: await availableInTx(db, variantId, sessionKey)
      };
    }

    if (quantity < currentQty) {
      await reduceReservations(db, existing, currentQty - quantity);
      const remaining = await db.query<StockReservation>(
        `select * from stock_reservations
         where session_key = $1
           and product_id = $2
           and variant_id is not distinct from $3
           and expires_at > now()`,
        [sessionKey, input.productId, variantId]
      );
      const soonest = remaining.length
        ? remaining.reduce((min, row) => (row.expires_at < min ? row.expires_at : min), remaining[0].expires_at)
        : null;
      return {
        reservedUntil: soonest,
        quantity,
        available: await availableInTx(db, variantId, sessionKey)
      };
    }

    // Need more units
    const need = quantity - currentQty;
    const free = await availableInTx(db, variantId, sessionKey);
    if (free < need) {
      throw new Error(`Only ${free} left available (your bag already holds ${currentQty})`);
    }

    const unitTotal = await db.queryOne<{ c: number }>(
      `select count(*)::int as c from product_items where variant_id = $1`,
      [variantId]
    );
    const expires = holdExpiry();

    if (Number(unitTotal?.c || 0) > 0) {
      const pieces = await db.query<{ id: string }>(
        `select id from product_items
         where variant_id = $1 and status = 'to_sell'
         order by seq asc
         limit $2
         for update skip locked`,
        [variantId, need]
      );
      if (pieces.length < need) {
        throw new Error(`Only ${pieces.length + currentQty} pieces available`);
      }
      for (const piece of pieces) {
        await db.query(
          `update product_items set status = 'reserved' where id = $1 and status = 'to_sell'`,
          [piece.id]
        );
        await db.query(
          `insert into stock_reservations
             (session_key, customer_id, product_id, variant_id, quantity, product_item_id, expires_at)
           values ($1, $2, $3, $4, 1, $5, $6)`,
          [
            sessionKey,
            input.customerId || null,
            input.productId,
            variantId,
            piece.id,
            expires.toISOString()
          ]
        );
      }
      await syncSellableStock(db, variantId);
    } else {
      // Quantity stock: one aggregate row per session line preferred
      const qtyRow = existing.find((row) => !row.product_item_id);
      if (qtyRow) {
        await db.query(
          `update stock_reservations
           set quantity = $2, expires_at = $3, updated_at = now(),
               customer_id = coalesce($4::uuid, customer_id)
           where id = $1`,
          [qtyRow.id, quantity, expires.toISOString(), input.customerId || null]
        );
      } else {
        await db.query(
          `insert into stock_reservations
             (session_key, customer_id, product_id, variant_id, quantity, expires_at)
           values ($1, $2, $3, $4, $5, $6)`,
          [
            sessionKey,
            input.customerId || null,
            input.productId,
            variantId,
            quantity,
            expires.toISOString()
          ]
        );
      }
    }

    // Do not refresh TTL on existing holds — only new units get a fresh 30 minutes.
    const all = await db.query<StockReservation>(
      `select * from stock_reservations
       where session_key = $1
         and product_id = $2
         and variant_id is not distinct from $3
         and expires_at > now()`,
      [sessionKey, input.productId, variantId]
    );
    const soonest = all.length
      ? all.reduce((min, row) => (row.expires_at < min ? row.expires_at : min), all[0].expires_at)
      : expires.toISOString();

    return {
      reservedUntil: soonest,
      quantity,
      available: await availableInTx(db, variantId, sessionKey)
    };
  });
}

async function availableInTx(db: Db, variantId: string, sessionKey: string) {
  const unitCount = await db.queryOne<{ c: number }>(
    `select count(*)::int as c from product_items where variant_id = $1`,
    [variantId]
  );
  if (Number(unitCount?.c || 0) > 0) {
    const sellable = await db.queryOne<{ c: number }>(
      `select count(*)::int as c from product_items
       where variant_id = $1 and status = 'to_sell'`,
      [variantId]
    );
    return Math.max(0, Number(sellable?.c || 0));
  }
  const variant = await db.queryOne<{ stock_quantity: number }>(
    `select stock_quantity from product_variants where id = $1`,
    [variantId]
  );
  const onHand = Math.max(0, Number(variant?.stock_quantity || 0));
  const held = await db.queryOne<{ qty: string }>(
    `select coalesce(sum(quantity), 0)::text as qty
     from stock_reservations
     where variant_id = $1
       and expires_at > now()
       and product_item_id is null
       and session_key <> $2`,
    [variantId, sessionKey]
  );
  return Math.max(0, onHand - Number(held?.qty || 0));
}

async function releaseSessionLine(db: Db, rows: StockReservation[]) {
  if (!rows.length) return;
  const itemIds = rows
    .map((row) => row.product_item_id)
    .filter((id): id is string => Boolean(id));
  const variantIds = [
    ...new Set(rows.map((row) => row.variant_id).filter((id): id is string => Boolean(id)))
  ];

  if (itemIds.length) {
    await db.query(
      `update product_items set status = 'to_sell'
       where id = any($1::uuid[]) and status = 'reserved'`,
      [itemIds]
    );
  }
  await db.query(`delete from stock_reservations where id = any($1::uuid[])`, [
    rows.map((row) => row.id)
  ]);
  for (const variantId of variantIds) {
    const hasUnits = await db.queryOne<{ c: number }>(
      `select count(*)::int as c from product_items where variant_id = $1`,
      [variantId]
    );
    if (Number(hasUnits?.c || 0) > 0) await syncSellableStock(db, variantId);
  }
}

async function reduceReservations(db: Db, rows: StockReservation[], releaseQty: number) {
  let left = releaseQty;
  // Prefer releasing piece holds first (newest first)
  const pieceRows = rows
    .filter((row) => row.product_item_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const qtyRows = rows.filter((row) => !row.product_item_id);

  for (const row of pieceRows) {
    if (left <= 0) break;
    await db.query(
      `update product_items set status = 'to_sell' where id = $1 and status = 'reserved'`,
      [row.product_item_id]
    );
    await db.query(`delete from stock_reservations where id = $1`, [row.id]);
    left -= 1;
    if (row.variant_id) await syncSellableStock(db, row.variant_id);
  }

  for (const row of qtyRows) {
    if (left <= 0) break;
    const qty = Number(row.quantity);
    if (qty <= left) {
      await db.query(`delete from stock_reservations where id = $1`, [row.id]);
      left -= qty;
    } else {
      await db.query(`update stock_reservations set quantity = $2, updated_at = now() where id = $1`, [
        row.id,
        qty - left
      ]);
      left = 0;
    }
  }
}

export async function listSessionReservations(sessionKey: string) {
  await ensureCartReservationsSchema();
  await releaseExpiredReservations();
  return query<StockReservation>(
    `select * from stock_reservations
     where session_key = $1 and expires_at > now()
     order by created_at asc`,
    [sessionKey]
  );
}

export async function releaseAllForSession(sessionKey: string) {
  await ensureCartReservationsSchema();
  return withTransaction(async (db) => {
    const rows = await db.query<StockReservation>(
      `select * from stock_reservations where session_key = $1 for update`,
      [sessionKey]
    );
    await releaseSessionLine(db, rows);
    return rows.length;
  });
}

/** Convert session holds into sold pieces / consume qty holds at payment. */
export async function consumeReservationsForOrder(input: {
  sessionKey: string | null;
  customerId: string;
  orderId: string;
  lines: Array<{ product_id: string; variant_id: string | null; quantity: number }>;
}) {
  await ensureCartReservationsSchema();

  return withTransaction(async (db) => {
    await releaseExpiredReservations(db);

    for (const line of input.lines) {
      let variantId = line.variant_id;
      if (!variantId) {
        const first = await db.queryOne<{ id: string }>(
          `select id from product_variants where product_id = $1 order by name asc limit 1`,
          [line.product_id]
        );
        variantId = first?.id || null;
      }
      if (!variantId) continue;

      const holds = await db.query<StockReservation>(
        `select * from stock_reservations
         where expires_at > now()
           and product_id = $1
           and variant_id is not distinct from $2
           and (
             session_key = $3
             or customer_id = $4
           )
         for update`,
        [line.product_id, variantId, input.sessionKey || "", input.customerId]
      );

      const pieceHolds = holds.filter((row) => row.product_item_id).slice(0, line.quantity);
      const pieceIds = pieceHolds
        .map((row) => row.product_item_id)
        .filter((id): id is string => Boolean(id));

      if (pieceIds.length) {
        await db.query(
          `update product_items
           set status = 'sold', date_sold = now(), bill_id = $2
           where id = any($1::uuid[])
             and status in ('reserved', 'to_sell')`,
          [pieceIds, input.orderId]
        );
        await db.query(`delete from stock_reservations where id = any($1::uuid[])`, [
          pieceHolds.map((row) => row.id)
        ]);
        await syncSellableStock(db, variantId);
      }

      const remainingQty = line.quantity - pieceIds.length;
      if (remainingQty > 0) {
        // Consume qty holds then deduct stock
        let left = remainingQty;
        const qtyHolds = holds.filter((row) => !row.product_item_id);
        for (const row of qtyHolds) {
          if (left <= 0) break;
          const qty = Number(row.quantity);
          if (qty <= left) {
            await db.query(`delete from stock_reservations where id = $1`, [row.id]);
            left -= qty;
          } else {
            await db.query(
              `update stock_reservations set quantity = $2, updated_at = now() where id = $1`,
              [row.id, qty - left]
            );
            left = 0;
          }
        }

        await db.query(
          `update product_variants
           set stock_quantity = greatest(0, stock_quantity - $2)
           where id = $1`,
          [variantId, remainingQty]
        );
        await db.query(
          `update products
           set stock_quantity = (
             select coalesce(sum(stock_quantity), 0) from product_variants where product_id = $1
           )
           where id = $1`,
          [line.product_id]
        );
      }
    }
  });
}

export function summarizeReservations(rows: StockReservation[]) {
  const byKey = new Map<
    string,
    { productId: string; variantId: string | null; quantity: number; reservedUntil: string }
  >();
  for (const row of rows) {
    const key = `${row.product_id}:${row.variant_id || ""}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, {
        productId: row.product_id,
        variantId: row.variant_id,
        quantity: Number(row.quantity),
        reservedUntil: row.expires_at
      });
    } else {
      current.quantity += Number(row.quantity);
      if (row.expires_at < current.reservedUntil) current.reservedUntil = row.expires_at;
    }
  }
  return [...byKey.values()];
}
