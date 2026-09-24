import { query, queryOne } from "./db/pool";
import { skipRuntimeSchemaEnsure } from "./schema-bootstrap";
import { CATEGORY_LABELS } from "./finance-labels";

export { CATEGORY_LABELS } from "./finance-labels";

export type FinanceDirection = "in" | "out";
export type FinanceStatus = "pending" | "cleared" | "cancelled";
export type FinanceMethod = "cash" | "upi" | "card" | "bank" | "cheque" | "razorpay" | "other";
export type FinanceCategory =
  | "sales"
  | "other_income"
  | "refund"
  | "purchase"
  | "expense"
  | "salary"
  | "rent"
  | "utilities"
  | "logistics"
  | "packaging"
  | "marketing"
  | "maintenance"
  | "tax"
  | "transfer"
  | "other";

export type FinanceEntry = {
  id: string;
  entry_no: string;
  direction: FinanceDirection;
  category: FinanceCategory | string;
  amount: string | number;
  payment_method: FinanceMethod | string;
  status: FinanceStatus | string;
  entry_date: string;
  counterparty_name: string | null;
  reference_no: string | null;
  notes: string | null;
  order_id: string | null;
  payment_id: string | null;
  shop_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  order_number?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  customer_id?: string | null;
  supplier_id?: string | null;
  account_id?: string | null;
  cash_account_id?: string | null;
  tax_amount?: string | number | null;
  updated_by?: string | null;
};

export const INCOME_CATEGORIES: FinanceCategory[] = ["sales", "other_income"];
export const COGS_CATEGORIES: FinanceCategory[] = ["purchase"];
export const OPEX_CATEGORIES: FinanceCategory[] = [
  "expense",
  "salary",
  "rent",
  "utilities",
  "logistics",
  "packaging",
  "marketing",
  "maintenance",
  "tax",
  "refund",
  "other"
];

let schemaReady = false;

export async function ensureFinanceSchema() {
  if (schemaReady || skipRuntimeSchemaEnsure()) return;

  await query(`
    create table if not exists public.finance_payment_entries (
      id uuid primary key default gen_random_uuid(),
      entry_no text not null,
      direction text not null check (direction in ('in', 'out')),
      category text not null,
      amount numeric(12,2) not null check (amount > 0),
      payment_method text not null default 'cash',
      status text not null default 'cleared',
      entry_date date not null default (current_date),
      counterparty_name text,
      reference_no text,
      notes text,
      order_id uuid references public.orders(id) on delete set null,
      payment_id uuid references public.payments(id) on delete set null,
      shop_id uuid,
      created_by uuid references public.users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await query(`
    create table if not exists public.finance_accounts (
      id uuid primary key default gen_random_uuid(),
      code text not null,
      name text not null,
      account_type text not null,
      parent_code text,
      is_system boolean not null default false,
      is_active boolean not null default true,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await query(`
    create unique index if not exists finance_accounts_code_uidx
      on public.finance_accounts (lower(code))
  `);

  await query(`
    create table if not exists public.finance_cash_accounts (
      id uuid primary key default gen_random_uuid(),
      code text not null,
      name text not null,
      kind text not null,
      opening_balance numeric(14,2) not null default 0,
      is_default boolean not null default false,
      is_active boolean not null default true,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await query(`
    create unique index if not exists finance_cash_accounts_code_uidx
      on public.finance_cash_accounts (lower(code))
  `);

  await query(`
    alter table public.finance_payment_entries
      add column if not exists reference_type text,
      add column if not exists reference_id text,
      add column if not exists customer_id uuid,
      add column if not exists supplier_id uuid,
      add column if not exists account_id uuid,
      add column if not exists cash_account_id uuid,
      add column if not exists tax_amount numeric(12,2) not null default 0,
      add column if not exists updated_by uuid
  `);

  await query(`
    create table if not exists public.finance_settings (
      id integer primary key default 1,
      fy_start_month integer not null default 4,
      default_cash_account_id uuid,
      default_bank_account_id uuid,
      default_sales_account_id uuid,
      default_purchase_account_id uuid,
      currency text not null default 'INR',
      updated_at timestamptz not null default now()
    )
  `);
  await query(`insert into public.finance_settings (id) values (1) on conflict (id) do nothing`);

  await query(`
    create unique index if not exists finance_payment_entries_entry_no_uidx
      on public.finance_payment_entries (lower(entry_no))
  `);
  await query(`
    create unique index if not exists finance_payment_entries_payment_uidx
      on public.finance_payment_entries (payment_id)
      where payment_id is not null
  `);
  await query(`
    create unique index if not exists finance_payment_entries_ref_uidx
      on public.finance_payment_entries (reference_type, reference_id)
      where reference_type is not null and reference_id is not null
  `);
  await query(`
    create index if not exists finance_payment_entries_date_idx
      on public.finance_payment_entries (entry_date desc, created_at desc)
  `);

  // Seed COA / cash wallets once
  await query(`
    insert into public.finance_accounts (code, name, account_type, is_system)
    select v.code, v.name, v.account_type, true
    from (values
      ('1000','Cash','asset'),('1010','Bank','asset'),('1100','Accounts Receivable','asset'),
      ('1200','Inventory','asset'),('1900','Other Assets','asset'),
      ('2000','Accounts Payable','liability'),('2100','Tax Payable','liability'),('2900','Other Liabilities','liability'),
      ('3000','Owner Capital','equity'),('3100','Retained Earnings','equity'),
      ('4000','Product Sales','income'),('4100','Service Income','income'),('4900','Other Income','income'),
      ('5000','Purchases','expense'),('5100','Salaries','expense'),('5200','Rent','expense'),
      ('5300','Electricity','expense'),('5400','Internet','expense'),('5500','Transport','expense'),
      ('5600','Maintenance','expense'),('5700','Marketing','expense'),('5800','Office Expenses','expense'),
      ('5900','Bank Charges','expense'),('5990','Other Expenses','expense')
    ) as v(code, name, account_type)
    where not exists (select 1 from public.finance_accounts a where lower(a.code) = lower(v.code))
  `);
  await query(`
    insert into public.finance_cash_accounts (code, name, kind, opening_balance, is_default)
    select 'CASH-001', 'Petty Cash', 'cash', 0, true
    where not exists (select 1 from public.finance_cash_accounts where lower(code) = 'cash-001')
  `);
  await query(`
    insert into public.finance_cash_accounts (code, name, kind, opening_balance, is_default)
    select 'BANK-001', 'Primary Bank', 'bank', 0, true
    where not exists (select 1 from public.finance_cash_accounts where lower(code) = 'bank-001')
  `);

  schemaReady = true;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

async function nextEntryNo(direction: FinanceDirection) {
  const prefix = direction === "in" ? "FIN-IN" : "FIN-OUT";
  const row = await queryOne<{ max_no: string | null }>(
    `select max(entry_no) as max_no
     from finance_payment_entries
     where entry_no like $1`,
    [`${prefix}-%`]
  );
  const raw = row?.max_no || "";
  const match = raw.match(/(\d+)$/);
  const next = (match ? Number(match[1]) : 0) + 1;
  return `${prefix}-${String(next).padStart(5, "0")}`;
}

function mapProviderMethod(provider: string): FinanceMethod {
  if (provider === "razorpay") return "razorpay";
  if (provider === "cash" || provider === "pos_cash") return "cash";
  if (provider === "upi") return "upi";
  if (provider === "card") return "card";
  if (provider === "bank") return "bank";
  return "other";
}

async function defaultCashAccountId(method: FinanceMethod) {
  const kind = method === "cash" ? "cash" : "bank";
  const row = await queryOne<{ id: string }>(
    `select id from finance_cash_accounts
     where is_active = true and kind = $1
     order by is_default desc, code
     limit 1`,
    [kind]
  );
  return row?.id || null;
}

/** Pull paid order payments into the finance cashbook (idempotent). */
export async function syncOrderPaymentsIntoFinance(limit = 200) {
  await ensureFinanceSchema();
  const paid = await query<{
    payment_id: string;
    order_id: string;
    amount: string;
    provider: string;
    created_at: string;
    order_number: string;
    channel: string;
    customer_name: string | null;
    customer_id: string | null;
    shop_id: string | null;
    tax_amount: string | null;
  }>(
    `select p.id as payment_id, p.order_id, p.amount, p.provider, p.created_at,
            o.order_number, coalesce(o.channel, 'online') as channel, o.shop_id, o.customer_id,
            o.tax_amount,
            coalesce(nullif(o.pos_customer_name, ''), c.full_name) as customer_name
     from payments p
     join orders o on o.id = p.order_id
     left join customers c on c.id = o.customer_id
     where p.status = 'paid'
       and o.payment_status = 'paid'
       and not exists (
         select 1 from finance_payment_entries f where f.payment_id = p.id
       )
     order by p.created_at desc
     limit $1`,
    [limit]
  );

  let inserted = 0;
  for (const row of paid) {
    const method = mapProviderMethod(row.provider);
    const entryNo = await nextEntryNo("in");
    const cashAccountId = await defaultCashAccountId(method);
    await query(
      `insert into finance_payment_entries (
         entry_no, direction, category, amount, payment_method, status, entry_date,
         counterparty_name, reference_no, notes, order_id, payment_id, shop_id,
         customer_id, reference_type, reference_id, cash_account_id, tax_amount
       ) values (
         $1, 'in', 'sales', $2, $3, 'cleared', ($4::timestamptz)::date,
         $5, $6, $7, $8, $9, $10,
         $11, 'payment', $12, $13, $14
       )
       on conflict do nothing`,
      [
        entryNo,
        Number(row.amount),
        method,
        row.created_at,
        row.customer_name || "Customer",
        row.order_number,
        `Auto-synced from ${row.channel} order ${row.order_number}`,
        row.order_id,
        row.payment_id,
        row.shop_id,
        row.customer_id,
        row.payment_id,
        cashAccountId,
        Number(row.tax_amount || 0)
      ]
    );
    inserted += 1;
  }
  return { scanned: paid.length, inserted };
}

/** Sync GRN purchase batches from audit log (does not change inventory flow). */
export async function syncPurchasesIntoFinance(limit = 100) {
  await ensureFinanceSchema();
  const rows = await query<{
    id: string;
    created_at: string;
    after: {
      supplierId?: string | null;
      supplier?: string | null;
      billNo?: string | null;
      invoiceAmount?: number | null;
      linesTotal?: number | null;
    } | null;
  }>(
    `select id, created_at, after
     from audit_logs
     where action = 'inventory_inward'
       and entity_type = 'inventory_movements'
       and not exists (
         select 1 from finance_payment_entries f
         where f.reference_type = 'grn_audit' and f.reference_id = audit_logs.id::text
       )
     order by created_at desc
     limit $1`,
    [limit]
  );

  let inserted = 0;
  for (const row of rows) {
    const after = row.after || {};
    const amount = Number(
      after.invoiceAmount != null && Number(after.invoiceAmount) > 0
        ? after.invoiceAmount
        : after.linesTotal || 0
    );
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const entryNo = await nextEntryNo("out");
    await query(
      `insert into finance_payment_entries (
         entry_no, direction, category, amount, payment_method, status, entry_date,
         counterparty_name, reference_no, notes, supplier_id,
         reference_type, reference_id
       ) values (
         $1, 'out', 'purchase', $2, 'other', 'pending', ($3::timestamptz)::date,
         $4, $5, $6, $7,
         'grn_audit', $8
       )
       on conflict do nothing`,
      [
        entryNo,
        round2(amount),
        row.created_at,
        after.supplier || "Supplier",
        after.billNo || null,
        `Auto-synced GRN purchase${after.billNo ? ` bill ${after.billNo}` : ""}`,
        after.supplierId || null,
        row.id
      ]
    );
    inserted += 1;
  }
  return { scanned: rows.length, inserted };
}

/** Sync refunded returns into outgoing cashbook (idempotent). */
export async function syncRefundsIntoFinance(limit = 100) {
  await ensureFinanceSchema();
  const rows = await query<{
    id: string;
    order_id: string;
    refund_amount: string;
    updated_at: string;
    order_number: string;
    customer_id: string | null;
    customer_name: string | null;
  }>(
    `select r.id, r.order_id, r.refund_amount, coalesce(r.updated_at, r.created_at) as updated_at,
            o.order_number, o.customer_id,
            coalesce(nullif(o.pos_customer_name, ''), c.full_name) as customer_name
     from order_returns r
     join orders o on o.id = r.order_id
     left join customers c on c.id = o.customer_id
     where r.status = 'refunded'
       and coalesce(r.refund_amount, 0) > 0
       and not exists (
         select 1 from finance_payment_entries f
         where f.reference_type = 'order_return' and f.reference_id = r.id::text
       )
     order by coalesce(r.updated_at, r.created_at) desc
     limit $1`,
    [limit]
  );

  let inserted = 0;
  for (const row of rows) {
    const amount = Number(row.refund_amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const entryNo = await nextEntryNo("out");
    const cashAccountId = await defaultCashAccountId("cash");
    await query(
      `insert into finance_payment_entries (
         entry_no, direction, category, amount, payment_method, status, entry_date,
         counterparty_name, reference_no, notes, order_id, customer_id,
         reference_type, reference_id, cash_account_id
       ) values (
         $1, 'out', 'refund', $2, 'cash', 'cleared', ($3::timestamptz)::date,
         $4, $5, $6, $7, $8,
         'order_return', $9, $10
       )
       on conflict do nothing`,
      [
        entryNo,
        round2(amount),
        row.updated_at,
        row.customer_name || "Customer",
        row.order_number,
        `Auto-synced refund for order ${row.order_number}`,
        row.order_id,
        row.customer_id,
        row.id,
        cashAccountId
      ]
    );
    inserted += 1;
  }
  return { scanned: rows.length, inserted };
}

/** Run all finance syncs from existing business tables (read-only side effects). */
export async function syncAllFinanceSources(limit = 200) {
  const payments = await syncOrderPaymentsIntoFinance(limit);
  const purchases = await syncPurchasesIntoFinance(Math.min(100, limit));
  const refunds = await syncRefundsIntoFinance(Math.min(100, limit));
  return {
    payments,
    purchases,
    refunds,
    inserted: payments.inserted + purchases.inserted + refunds.inserted
  };
}

export type ListFinanceFilters = {
  direction?: FinanceDirection | "all";
  status?: FinanceStatus | "all";
  category?: string;
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
};

export async function listFinanceEntries(filters: ListFinanceFilters = {}) {
  await ensureFinanceSchema();
  const limit = Math.min(500, Math.max(1, filters.limit || 100));
  const params: unknown[] = [];
  const where: string[] = ["1=1"];

  if (filters.direction && filters.direction !== "all") {
    params.push(filters.direction);
    where.push(`f.direction = $${params.length}`);
  }
  if (filters.status && filters.status !== "all") {
    params.push(filters.status);
    where.push(`f.status = $${params.length}`);
  }
  if (filters.category) {
    params.push(filters.category);
    where.push(`f.category = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    where.push(`f.entry_date >= $${params.length}::date`);
  }
  if (filters.to) {
    params.push(filters.to);
    where.push(`f.entry_date <= $${params.length}::date`);
  }
  if (filters.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    where.push(
      `(f.entry_no ilike $${params.length} or f.counterparty_name ilike $${params.length} or f.reference_no ilike $${params.length} or f.notes ilike $${params.length} or o.order_number ilike $${params.length})`
    );
  }
  params.push(limit);

  return query<FinanceEntry>(
    `select f.*, o.order_number
     from finance_payment_entries f
     left join orders o on o.id = f.order_id
     where ${where.join(" and ")}
     order by f.entry_date desc, f.created_at desc
     limit $${params.length}`,
    params
  );
}

export async function createFinanceEntry(input: {
  direction: FinanceDirection;
  category: FinanceCategory;
  amount: number;
  payment_method?: FinanceMethod;
  status?: FinanceStatus;
  entry_date?: string;
  counterparty_name?: string | null;
  reference_no?: string | null;
  notes?: string | null;
  order_id?: string | null;
  shop_id?: string | null;
  created_by?: string | null;
}) {
  await ensureFinanceSchema();
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  const entryNo = await nextEntryNo(input.direction);
  const row = await queryOne<FinanceEntry>(
    `insert into finance_payment_entries (
       entry_no, direction, category, amount, payment_method, status, entry_date,
       counterparty_name, reference_no, notes, order_id, shop_id, created_by
     ) values (
       $1, $2, $3, $4, $5, $6, coalesce($7::date, current_date),
       $8, $9, $10, $11, $12, $13
     )
     returning *`,
    [
      entryNo,
      input.direction,
      input.category,
      round2(input.amount),
      input.payment_method || "cash",
      input.status || "cleared",
      input.entry_date || null,
      input.counterparty_name || null,
      input.reference_no || null,
      input.notes || null,
      input.order_id || null,
      input.shop_id || null,
      input.created_by || null
    ]
  );
  if (!row) throw new Error("Failed to create finance entry");
  return row;
}

export async function updateFinanceEntry(
  id: string,
  patch: Partial<{
    category: FinanceCategory;
    amount: number;
    payment_method: FinanceMethod;
    status: FinanceStatus;
    entry_date: string;
    counterparty_name: string | null;
    reference_no: string | null;
    notes: string | null;
  }>
) {
  await ensureFinanceSchema();
  const before = await queryOne<FinanceEntry>(
    `select * from finance_payment_entries where id = $1`,
    [id]
  );
  if (!before) throw new Error("Entry not found");

  const amount =
    patch.amount !== undefined ? round2(Number(patch.amount)) : Number(before.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than 0");

  const row = await queryOne<FinanceEntry>(
    `update finance_payment_entries set
       category = coalesce($2, category),
       amount = $3,
       payment_method = coalesce($4, payment_method),
       status = coalesce($5, status),
       entry_date = coalesce($6::date, entry_date),
       counterparty_name = case when $7::boolean then $8 else counterparty_name end,
       reference_no = case when $9::boolean then $10 else reference_no end,
       notes = case when $11::boolean then $12 else notes end,
       updated_at = now()
     where id = $1
     returning *`,
    [
      id,
      patch.category ?? null,
      amount,
      patch.payment_method ?? null,
      patch.status ?? null,
      patch.entry_date ?? null,
      patch.counterparty_name !== undefined,
      patch.counterparty_name ?? null,
      patch.reference_no !== undefined,
      patch.reference_no ?? null,
      patch.notes !== undefined,
      patch.notes ?? null
    ]
  );
  if (!row) throw new Error("Failed to update entry");
  return row;
}

export type LedgerRow = FinanceEntry & {
  signed_amount: number;
  running_balance: number;
};

export async function buildLedger(filters: { from?: string; to?: string; q?: string } = {}) {
  await ensureFinanceSchema();
  const rows = await listFinanceEntries({
    ...filters,
    status: "cleared",
    direction: "all",
    limit: 500
  });
  // Chronological for running balance
  const chronological = [...rows].reverse();
  let balance = 0;
  const withBalance: LedgerRow[] = chronological.map((row) => {
    const amount = Number(row.amount);
    const signed = row.direction === "in" ? amount : -amount;
    balance = round2(balance + signed);
    return {
      ...row,
      signed_amount: signed,
      running_balance: balance
    };
  });
  return withBalance.reverse();
}

export type PnLSummary = {
  from: string;
  to: string;
  revenue: number;
  other_income: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  net_profit: number;
  by_category: Array<{ category: string; label: string; direction: string; total: number }>;
  incoming_total: number;
  outgoing_total: number;
  pending_in: number;
  pending_out: number;
};

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export async function buildProfitAndLoss(input?: { from?: string; to?: string }): Promise<PnLSummary> {
  await ensureFinanceSchema();
  const range = {
    from: input?.from || defaultRange().from,
    to: input?.to || defaultRange().to
  };

  // SQL aggregation — do not sync or load hundreds of rows on every P&L/dashboard hit.
  const cleared = await query<{
    direction: string;
    category: string;
    total: string;
  }>(
    `select direction, category, coalesce(sum(amount),0)::text as total
     from finance_payment_entries
     where status = 'cleared'
       and entry_date between $1::date and $2::date
     group by direction, category`,
    [range.from, range.to]
  );
  const pending = await query<{ direction: string; total: string }>(
    `select direction, coalesce(sum(amount),0)::text as total
     from finance_payment_entries
     where status = 'pending'
       and entry_date between $1::date and $2::date
     group by direction`,
    [range.from, range.to]
  );

  let revenue = 0;
  let otherIncome = 0;
  let cogs = 0;
  let opex = 0;
  let incoming = 0;
  let outgoing = 0;
  const byCat: Array<{ category: string; label: string; direction: string; total: number }> = [];

  for (const row of cleared) {
    const amount = Number(row.total);
    byCat.push({
      category: row.category,
      label: CATEGORY_LABELS[row.category] || row.category,
      direction: row.direction,
      total: amount
    });

    if (row.direction === "in") {
      incoming = round2(incoming + amount);
      if (row.category === "sales") revenue = round2(revenue + amount);
      else if (row.category !== "transfer") otherIncome = round2(otherIncome + amount);
    } else {
      outgoing = round2(outgoing + amount);
      if (COGS_CATEGORIES.includes(row.category as FinanceCategory)) {
        cogs = round2(cogs + amount);
      } else if (row.category !== "transfer") {
        opex = round2(opex + amount);
      }
    }
  }

  const gross = round2(revenue + otherIncome - cogs);
  const net = round2(gross - opex);

  return {
    from: range.from,
    to: range.to,
    revenue,
    other_income: otherIncome,
    cogs,
    gross_profit: gross,
    operating_expenses: opex,
    net_profit: net,
    by_category: byCat.sort((a, b) => b.total - a.total),
    incoming_total: incoming,
    outgoing_total: outgoing,
    pending_in: round2(
      Number(pending.find((r) => r.direction === "in")?.total || 0)
    ),
    pending_out: round2(
      Number(pending.find((r) => r.direction === "out")?.total || 0)
    )
  };
}
