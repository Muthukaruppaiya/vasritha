import type { QueryResultRow } from "pg";
import { query, queryOne } from "./db/pool";
import { ensurePosSchema } from "./pos";
import { skipEnsureIfRelationExists } from "./schema-bootstrap";

type DbClient = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<T[]>;
  queryOne: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<T | null>;
};

let schemaReady: Promise<void> | null = null;

async function runEnsurePosShiftSchema() {
  await ensurePosSchema();
  await query(`
    alter table public.orders
      add column if not exists created_by uuid references public.users(id) on delete set null,
      add column if not exists shift_id uuid
  `);
  await query(`
    create index if not exists orders_created_by_idx on public.orders (created_by)
  `);
  await query(`
    create index if not exists orders_shift_id_idx on public.orders (shift_id)
  `);

  if (!(await skipEnsureIfRelationExists("public.pos_shifts"))) {
    await query(`
      create table if not exists public.pos_shifts (
        id uuid primary key default gen_random_uuid(),
        shop_id uuid not null references public.shops(id) on delete cascade,
        opened_by uuid not null references public.users(id) on delete restrict,
        closed_by uuid references public.users(id) on delete set null,
        opened_at timestamptz not null default now(),
        closed_at timestamptz,
        status text not null default 'open' check (status in ('open', 'closed')),
        opening_float numeric(12,2) not null default 0,
        closing_cash_counted numeric(12,2),
        notes text,
        handover_to uuid references public.users(id) on delete set null,
        summary jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);
  }

  await query(`
    create index if not exists pos_shifts_shop_status_idx
      on public.pos_shifts (shop_id, status, opened_at desc)
  `);
  // One active till session per shop (handover closes current, then next staff opens).
  await query(`
    create unique index if not exists pos_shifts_one_open_per_shop
      on public.pos_shifts (shop_id)
      where status = 'open'
  `);

  // Link shift_id FK after table exists
  await query(`
    do $$ begin
      alter table public.orders
        add constraint orders_shift_id_fkey
        foreign key (shift_id) references public.pos_shifts(id) on delete set null;
    exception when duplicate_object then null;
    end $$;
  `);
}

export async function ensurePosShiftSchema() {
  if (!schemaReady) {
    schemaReady = runEnsurePosShiftSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export type ShiftSummary = {
  bill_count: number;
  items_sold: number;
  sales_total: number;
  cash_total: number;
  upi_total: number;
  card_total: number;
  razorpay_total: number;
  credit_sales_total: number;
  collected_on_credit: number;
  discount_total: number;
  balance_due_total: number;
};

export type PosShiftRow = {
  id: string;
  shop_id: string;
  opened_by: string;
  closed_by: string | null;
  opened_at: string;
  closed_at: string | null;
  status: "open" | "closed";
  opening_float: string | number;
  closing_cash_counted: string | number | null;
  notes: string | null;
  handover_to: string | null;
  summary: ShiftSummary | null;
  opener_name?: string | null;
  opener_code?: string | null;
  closer_name?: string | null;
  handover_name?: string | null;
};

function emptySummary(): ShiftSummary {
  return {
    bill_count: 0,
    items_sold: 0,
    sales_total: 0,
    cash_total: 0,
    upi_total: 0,
    card_total: 0,
    razorpay_total: 0,
    credit_sales_total: 0,
    collected_on_credit: 0,
    discount_total: 0,
    balance_due_total: 0
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function getOpenShiftForUser(shopId: string, userId: string) {
  await ensurePosShiftSchema();
  return queryOne<PosShiftRow>(
    `select s.*,
            u.full_name as opener_name,
            u.email as opener_code
     from pos_shifts s
     left join users u on u.id = s.opened_by
     where s.shop_id = $1 and s.opened_by = $2 and s.status = 'open'
     order by s.opened_at desc
     limit 1`,
    [shopId, userId]
  );
}

export async function getOpenShiftForShop(shopId: string) {
  await ensurePosShiftSchema();
  return queryOne<PosShiftRow>(
    `select s.*,
            u.full_name as opener_name,
            u.email as opener_code
     from pos_shifts s
     left join users u on u.id = s.opened_by
     where s.shop_id = $1 and s.status = 'open'
     order by s.opened_at desc
     limit 1`,
    [shopId]
  );
}

export async function openPosShift(input: {
  shopId: string;
  userId: string;
  openingFloat?: number;
  notes?: string;
}) {
  await ensurePosShiftSchema();
  const mine = await getOpenShiftForUser(input.shopId, input.userId);
  if (mine) return mine;

  const shopOpen = await getOpenShiftForShop(input.shopId);
  if (shopOpen && shopOpen.opened_by !== input.userId) {
    throw new Error(
      `Shift already open for ${shopOpen.opener_name || "another staff"}. Close / handover first.`
    );
  }

  const float = Math.max(0, Number(input.openingFloat) || 0);
  const row = await queryOne<PosShiftRow>(
    `insert into pos_shifts (shop_id, opened_by, opening_float, notes, status)
     values ($1, $2, $3, $4, 'open')
     returning *`,
    [input.shopId, input.userId, float, input.notes?.trim() || null]
  );
  if (!row) throw new Error("Could not open shift");
  return row;
}

/** Aggregate POS sales for a cashier during a time window (and optionally shift_id). */
export async function buildShiftSalesSummary(input: {
  shopId: string;
  userId: string;
  shiftId?: string | null;
  from: string;
  to?: string | null;
}): Promise<ShiftSummary> {
  await ensurePosShiftSchema();
  const to = input.to || new Date().toISOString();

  const orders = await query<{
    id: string;
    total_amount: string | number;
    discount_amount: string | number;
    payment_status: string;
    paid_now: string | number | null;
  }>(
    `select o.id, o.total_amount, o.discount_amount, o.payment_status,
            (
              select coalesce(sum(p.amount), 0)
              from payments p
              where p.order_id = o.id
            ) as paid_now
     from orders o
     where o.channel = 'pos'
       and o.shop_id = $1
       and o.created_by = $2
       and o.created_at >= $3::timestamptz
       and o.created_at < $4::timestamptz
       and ($5::uuid is null or o.shift_id = $5)
       and o.status <> 'cancelled'`,
    [input.shopId, input.userId, input.from, to, input.shiftId || null]
  );

  const summary = emptySummary();
  summary.bill_count = orders.length;

  for (const order of orders) {
    const total = Number(order.total_amount) || 0;
    const discount = Number(order.discount_amount) || 0;
    const paid = Number(order.paid_now) || 0;
    summary.sales_total = round2(summary.sales_total + total);
    summary.discount_total = round2(summary.discount_total + discount);
    const due = Math.max(0, round2(total - paid));
    summary.balance_due_total = round2(summary.balance_due_total + due);
  }

  const items = await queryOne<{ qty: string | number }>(
    `select coalesce(sum(oi.quantity), 0) as qty
     from order_items oi
     join orders o on o.id = oi.order_id
     where o.channel = 'pos'
       and o.shop_id = $1
       and o.created_by = $2
       and o.created_at >= $3::timestamptz
       and o.created_at < $4::timestamptz
       and ($5::uuid is null or o.shift_id = $5)
       and o.status <> 'cancelled'`,
    [input.shopId, input.userId, input.from, to, input.shiftId || null]
  );
  summary.items_sold = Math.trunc(Number(items?.qty) || 0);

  // Payment split from payments.provider (cash / pos_credit / razorpay / upi / card).
  const pays = await query<{ provider: string; amount: string | number }>(
    `select lower(coalesce(p.provider, 'cash')) as provider, coalesce(sum(p.amount), 0) as amount
     from payments p
     join orders o on o.id = p.order_id
     where o.channel = 'pos'
       and o.shop_id = $1
       and o.created_by = $2
       and o.created_at >= $3::timestamptz
       and o.created_at < $4::timestamptz
       and ($5::uuid is null or o.shift_id = $5)
       and o.status <> 'cancelled'
       and p.status = 'paid'
     group by 1`,
    [input.shopId, input.userId, input.from, to, input.shiftId || null]
  );

  for (const row of pays) {
    const amt = round2(Number(row.amount) || 0);
    const m = String(row.provider || "cash");
    if (m.includes("upi")) summary.upi_total = round2(summary.upi_total + amt);
    else if (m.includes("card")) summary.card_total = round2(summary.card_total + amt);
    else if (m.includes("razorpay")) summary.razorpay_total = round2(summary.razorpay_total + amt);
    else if (m.includes("credit")) summary.collected_on_credit = round2(summary.collected_on_credit + amt);
    else summary.cash_total = round2(summary.cash_total + amt);
  }

  // Credit sales = bills not fully paid at checkout window
  summary.credit_sales_total = summary.balance_due_total;

  return summary;
}

export async function closePosShift(input: {
  shiftId: string;
  userId: string;
  closingCashCounted?: number | null;
  notes?: string | null;
  handoverTo?: string | null;
  db?: DbClient;
}) {
  await ensurePosShiftSchema();
  const runner = input.db || { query, queryOne };

  const shift = await runner.queryOne<PosShiftRow>(
    `select * from pos_shifts where id = $1 for update`,
    [input.shiftId]
  );
  if (!shift) throw new Error("Shift not found");
  if (shift.status !== "open") throw new Error("Shift already closed");
  if (shift.opened_by !== input.userId) {
    // Managers may close on behalf — still record closer
  }

  const summary = await buildShiftSalesSummary({
    shopId: shift.shop_id,
    userId: shift.opened_by,
    shiftId: shift.id,
    from: shift.opened_at,
    to: new Date().toISOString()
  });

  const closed = await runner.queryOne<PosShiftRow>(
    `update pos_shifts
     set status = 'closed',
         closed_at = now(),
         closed_by = $2,
         closing_cash_counted = $3,
         notes = coalesce(nullif(trim($4), ''), notes),
         handover_to = $5,
         summary = $6::jsonb,
         updated_at = now()
     where id = $1
     returning *`,
    [
      input.shiftId,
      input.userId,
      input.closingCashCounted != null && Number.isFinite(Number(input.closingCashCounted))
        ? Number(input.closingCashCounted)
        : null,
      input.notes || null,
      input.handoverTo || null,
      JSON.stringify(summary)
    ]
  );
  if (!closed) throw new Error("Could not close shift");
  return { shift: closed, summary };
}

export async function listPosShifts(input: {
  shopId: string;
  limit?: number;
  offset?: number;
}) {
  await ensurePosShiftSchema();
  const limit = Math.min(100, Math.max(1, input.limit || 10));
  const offset = Math.max(0, input.offset || 0);

  const rows = await query<PosShiftRow>(
    `select s.*,
            opener.full_name as opener_name,
            opener.email as opener_code,
            closer.full_name as closer_name,
            hand.full_name as handover_name
     from pos_shifts s
     left join users opener on opener.id = s.opened_by
     left join users closer on closer.id = s.closed_by
     left join users hand on hand.id = s.handover_to
     where s.shop_id = $1
     order by s.opened_at desc
     limit $2 offset $3`,
    [input.shopId, limit, offset]
  );

  const totalRow = await queryOne<{ c: number }>(
    `select count(*)::int as c from pos_shifts where shop_id = $1`,
    [input.shopId]
  );

  return { rows, total: Number(totalRow?.c || 0), limit, offset };
}

export async function getPosShiftDetail(shiftId: string) {
  await ensurePosShiftSchema();
  return queryOne<PosShiftRow>(
    `select s.*,
            opener.full_name as opener_name,
            opener.email as opener_code,
            closer.full_name as closer_name,
            hand.full_name as handover_name
     from pos_shifts s
     left join users opener on opener.id = s.opened_by
     left join users closer on closer.id = s.closed_by
     left join users hand on hand.id = s.handover_to
     where s.id = $1`,
    [shiftId]
  );
}
