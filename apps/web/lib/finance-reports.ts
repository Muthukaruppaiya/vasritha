import { query, queryOne } from "./db/pool";
import {
  buildProfitAndLoss,
  ensureFinanceSchema,
  listFinanceEntries,
  type PnLSummary
} from "./finance";
import { listCashAccounts } from "./finance-accounts";
import { resolveFinancePeriod, type FinancePeriodKey } from "./finance-period";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function daysBetween(from: string, to = new Date()) {
  const a = new Date(from);
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

function ageingBucket(days: number) {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export async function buildFinanceDashboard(input?: {
  period?: string;
  from?: string;
  to?: string;
  fyStartMonth?: number;
}) {
  await ensureFinanceSchema();
  const range = resolveFinancePeriod(input?.period as FinancePeriodKey, {
    from: input?.from,
    to: input?.to,
    fyStartMonth: input?.fyStartMonth
  });
  const today = resolveFinancePeriod("today");
  const month = resolveFinancePeriod("this_month");

  const [pnl, monthPnl, todaySales, cashAccounts, arOpen, salesTrend, apPending, upiBankIn] = await Promise.all([
    buildProfitAndLoss({ from: range.from, to: range.to }),
    buildProfitAndLoss({ from: month.from, to: month.to }),
    queryOne<{ total: string }>(
      `select coalesce(sum(total_amount),0)::text as total
       from orders
       where payment_status = 'paid'
         and created_at::date = $1::date
         and coalesce(status,'') not in ('cancelled')`,
      [today.from]
    ),
    listCashAccounts(true),
    queryOne<{ count: string; total: string }>(
      `select count(*)::text as count, coalesce(sum(total_amount),0)::text as total
       from orders
       where payment_status = 'pending'
         and coalesce(status, '') not in ('cancelled')`
    ).catch(() => ({ count: "0", total: "0" })),
    query<{ day: string; total: string }>(
      `select to_char(date_trunc('day', o.created_at), 'DD Mon') as day,
              coalesce(sum(o.total_amount),0)::text as total
       from orders o
       where o.payment_status = 'paid'
         and o.created_at::date between $1::date and $2::date
       group by date_trunc('day', o.created_at)
       order by date_trunc('day', o.created_at)`,
      [range.from, range.to]
    ).catch(() => []),
    queryOne<{ count: string; total: string }>(
      `select count(*)::text as count, coalesce(sum(amount),0)::text as total
       from finance_payment_entries
       where direction = 'out' and category = 'purchase' and status = 'pending'`
    ).catch(() => ({ count: "0", total: "0" })),
    queryOne<{ total: string }>(
      `select coalesce(sum(amount),0)::text as total
       from finance_payment_entries
       where status = 'cleared' and direction = 'in'
         and payment_method in ('upi','card','bank','razorpay')
         and entry_date between $1::date and $2::date`,
      [range.from, range.to]
    )
  ]);

  const cashBal = round2(
    cashAccounts.filter((a) => a.kind === "cash").reduce((s, a) => s + Number(a.current_balance || 0), 0)
  );
  const bankBal = round2(
    cashAccounts.filter((a) => a.kind === "bank").reduce((s, a) => s + Number(a.current_balance || 0), 0)
  );

  return {
    sync: { inserted: 0, scanned: 0 },
    period: range,
    cards: {
      today_sales: Number(todaySales?.total || 0),
      monthly_sales: monthPnl.revenue,
      total_purchases: pnl.cogs,
      total_expenses: pnl.operating_expenses,
      gross_profit: pnl.gross_profit,
      net_profit: pnl.net_profit,
      customer_outstanding: Number(arOpen?.total || 0),
      supplier_outstanding: round2(Number(apPending?.total || 0)),
      cash_balance: cashBal,
      bank_upi_balance: bankBal,
      period_bank_upi_receipts: Number(upiBankIn?.total || 0),
      open_customer_bills: Number(arOpen?.count || 0),
      open_supplier_bills: Number(apPending?.count || 0)
    },
    pnl,
    charts: {
      sales_trend: (salesTrend || []).map((r) => ({
        label: r.day,
        total: Number(r.total)
      })),
      revenue_vs_expense: [
        { label: "Sales", value: pnl.revenue },
        { label: "Purchases", value: pnl.cogs },
        { label: "Expenses", value: pnl.operating_expenses }
      ]
    }
  };
}

export type ReceivableRow = {
  order_id: string;
  order_number: string;
  customer_name: string | null;
  customer_id: string | null;
  invoice_date: string;
  invoice_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  payment_status: string;
  days_overdue: number;
  ageing: string;
  status_label: string;
};

export async function listReceivables(filters: { from?: string; to?: string; q?: string } = {}) {
  await ensureFinanceSchema();
  const params: unknown[] = [];
  const where = [
    `o.payment_status in ('pending', 'failed')`,
    `coalesce(o.status, '') not in ('cancelled')`
  ];
  if (filters.from) {
    params.push(filters.from);
    where.push(`o.created_at::date >= $${params.length}::date`);
  }
  if (filters.to) {
    params.push(filters.to);
    where.push(`o.created_at::date <= $${params.length}::date`);
  }
  if (filters.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    where.push(
      `(o.order_number ilike $${params.length} or c.full_name ilike $${params.length} or o.pos_customer_name ilike $${params.length})`
    );
  }

  const rows = await query<{
    order_id: string;
    order_number: string;
    customer_name: string | null;
    customer_id: string | null;
    created_at: string;
    total_amount: string;
    payment_status: string;
    paid_sum: string;
  }>(
    `select o.id as order_id, o.order_number, o.customer_id, o.created_at, o.total_amount, o.payment_status,
            coalesce(nullif(o.pos_customer_name, ''), c.full_name, 'Walk-in') as customer_name,
            coalesce((select sum(p.amount) from payments p where p.order_id = o.id and p.status = 'paid'), 0)::text as paid_sum
     from orders o
     left join customers c on c.id = o.customer_id
     where ${where.join(" and ")}
     order by o.created_at desc
     limit 300`,
    params
  );

  return rows.map((row) => {
    const invoice = Number(row.total_amount);
    const paid = Number(row.paid_sum);
    const outstanding = round2(Math.max(0, invoice - paid));
    const days = daysBetween(row.created_at);
    const status_label =
      paid <= 0 ? (days > 30 ? "Overdue" : "Unpaid") : outstanding > 0 ? "Partially Paid" : "Paid";
    return {
      order_id: row.order_id,
      order_number: row.order_number,
      customer_name: row.customer_name,
      customer_id: row.customer_id,
      invoice_date: row.created_at,
      invoice_amount: invoice,
      paid_amount: paid,
      outstanding_amount: outstanding,
      payment_status: row.payment_status,
      days_overdue: days,
      ageing: ageingBucket(days),
      status_label
    } satisfies ReceivableRow;
  });
}

export type PayableRow = {
  entry_id: string;
  entry_no: string;
  supplier_name: string | null;
  supplier_id: string | null;
  invoice_date: string;
  invoice_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  reference_no: string | null;
  days_overdue: number;
  ageing: string;
  status_label: string;
  status: string;
};

export async function listPayables(filters: { from?: string; to?: string; q?: string } = {}) {
  await ensureFinanceSchema();
  const rows = await listFinanceEntries({
    direction: "out",
    category: "purchase",
    status: "all",
    from: filters.from,
    to: filters.to,
    q: filters.q,
    limit: 300
  });

  return rows
    .filter((r) => r.status !== "cancelled")
    .map((row) => {
      const invoice = Number(row.amount);
      const paid = row.status === "cleared" ? invoice : 0;
      const outstanding = row.status === "pending" ? invoice : 0;
      const days = daysBetween(row.entry_date);
      return {
        entry_id: row.id,
        entry_no: row.entry_no,
        supplier_name: row.counterparty_name,
        supplier_id: row.supplier_id || null,
        invoice_date: row.entry_date,
        invoice_amount: invoice,
        paid_amount: paid,
        outstanding_amount: outstanding,
        reference_no: row.reference_no,
        days_overdue: days,
        ageing: ageingBucket(days),
        status_label:
          row.status === "cleared"
            ? "Paid"
            : days > 30
              ? "Overdue"
              : "Unpaid",
        status: row.status
      } satisfies PayableRow;
    });
}

export async function buildCashFlow(input?: { from?: string; to?: string }) {
  await ensureFinanceSchema();
  const pnl = await buildProfitAndLoss(input);
  const from = pnl.from;
  const to = pnl.to;

  const before = await queryOne<{ inn: string; out: string }>(
    `select
       coalesce(sum(amount) filter (where direction = 'in'),0)::text as inn,
       coalesce(sum(amount) filter (where direction = 'out'),0)::text as out
     from finance_payment_entries
     where status = 'cleared' and entry_date < $1::date`,
    [from]
  );
  const openingCash = await queryOne<{ total: string }>(
    `select coalesce(sum(opening_balance),0)::text as total from finance_cash_accounts where is_active = true`
  );
  const opening = round2(Number(openingCash?.total || 0) + Number(before?.inn || 0) - Number(before?.out || 0));

  const cleared = await listFinanceEntries({ from, to, status: "cleared", limit: 500 });
  let customerPayments = 0;
  let otherIncome = 0;
  let transfersIn = 0;
  let supplierPayments = 0;
  let expenses = 0;
  let refunds = 0;
  let taxPayments = 0;
  let transfersOut = 0;

  for (const row of cleared) {
    const amount = Number(row.amount);
    if (row.direction === "in") {
      if (row.category === "sales") customerPayments = round2(customerPayments + amount);
      else if (row.category === "transfer") transfersIn = round2(transfersIn + amount);
      else otherIncome = round2(otherIncome + amount);
    } else {
      if (row.category === "purchase") supplierPayments = round2(supplierPayments + amount);
      else if (row.category === "refund") refunds = round2(refunds + amount);
      else if (row.category === "tax") taxPayments = round2(taxPayments + amount);
      else if (row.category === "transfer") transfersOut = round2(transfersOut + amount);
      else expenses = round2(expenses + amount);
    }
  }

  const inflows = round2(customerPayments + otherIncome + transfersIn);
  const outflows = round2(supplierPayments + expenses + refunds + taxPayments + transfersOut);
  return {
    from,
    to,
    opening_balance: opening,
    inflows: {
      customer_payments: customerPayments,
      other_income: otherIncome,
      transfers_in: transfersIn,
      total: inflows
    },
    outflows: {
      supplier_payments: supplierPayments,
      expenses,
      refunds,
      tax_payments: taxPayments,
      transfers_out: transfersOut,
      total: outflows
    },
    closing_balance: round2(opening + inflows - outflows)
  };
}

export async function buildBalanceSheet(input?: { asOf?: string }) {
  await ensureFinanceSchema();
  const asOf = input?.asOf || new Date().toISOString().slice(0, 10);
  const cashAccounts = await listCashAccounts(true);
  const cash = round2(
    cashAccounts.filter((a) => a.kind === "cash").reduce((s, a) => s + Number(a.current_balance || 0), 0)
  );
  const bank = round2(
    cashAccounts.filter((a) => a.kind === "bank").reduce((s, a) => s + Number(a.current_balance || 0), 0)
  );

  const ar = await queryOne<{ total: string }>(
    `select coalesce(sum(total_amount),0)::text as total
     from orders
     where payment_status = 'pending' and coalesce(status,'') not in ('cancelled')`
  );
  const apRows = await listFinanceEntries({
    direction: "out",
    category: "purchase",
    status: "pending",
    limit: 500
  });
  const ap = round2(apRows.reduce((s, r) => s + Number(r.amount), 0));

  const tax = await queryOne<{ total: string }>(
    `select coalesce(sum(tax_amount),0)::text as total
     from orders where payment_status = 'paid'`
  );

  const pnl = await buildProfitAndLoss({
    from: "2000-01-01",
    to: asOf
  });

  const assets = {
    cash,
    bank,
    accounts_receivable: Number(ar?.total || 0),
    inventory: 0,
    other_assets: 0,
    total: 0
  };
  assets.total = round2(
    assets.cash + assets.bank + assets.accounts_receivable + assets.inventory + assets.other_assets
  );

  const liabilities = {
    accounts_payable: ap,
    tax_payable: Number(tax?.total || 0),
    other_liabilities: 0,
    total: 0
  };
  liabilities.total = round2(
    liabilities.accounts_payable + liabilities.tax_payable + liabilities.other_liabilities
  );

  const equity = {
    capital: 0,
    retained_earnings: pnl.net_profit,
    total: 0
  };
  // Balance the sheet: equity absorbs residual so Assets = L + E for simplified cashbook model
  equity.capital = round2(Math.max(0, assets.total - liabilities.total - equity.retained_earnings));
  equity.total = round2(equity.capital + equity.retained_earnings);

  return {
    as_of: asOf,
    assets,
    liabilities,
    equity,
    balanced: Math.abs(assets.total - (liabilities.total + equity.total)) < 0.02,
    note: "Simplified SMB balance sheet from cashbook + open AR/AP (not full double-entry)."
  };
}

export async function buildSalesFinanceReport(filters: { from?: string; to?: string } = {}) {
  await ensureFinanceSchema();
  const range = {
    from: filters.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: filters.to || new Date().toISOString().slice(0, 10)
  };
  const rows = await query<{
    order_id: string;
    order_number: string;
    created_at: string;
    customer_name: string | null;
    subtotal: string;
    discount_amount: string;
    tax_amount: string;
    total_amount: string;
    payment_status: string;
    channel: string;
    paid_sum: string;
    provider: string | null;
  }>(
    `select o.id as order_id, o.order_number, o.created_at, o.subtotal, o.discount_amount, o.tax_amount,
            o.total_amount, o.payment_status, coalesce(o.channel,'online') as channel,
            coalesce(nullif(o.pos_customer_name,''), c.full_name, 'Walk-in') as customer_name,
            coalesce((select sum(p.amount) from payments p where p.order_id = o.id and p.status = 'paid'),0)::text as paid_sum,
            (select p.provider from payments p where p.order_id = o.id and p.status = 'paid' order by p.created_at desc limit 1) as provider
     from orders o
     left join customers c on c.id = o.customer_id
     where o.created_at::date between $1::date and $2::date
       and coalesce(o.status,'') not in ('cancelled')
     order by o.created_at desc
     limit 500`,
    [range.from, range.to]
  );

  return {
    from: range.from,
    to: range.to,
    rows: rows.map((r) => {
      const total = Number(r.total_amount);
      const paid = Number(r.paid_sum);
      return {
        date: r.created_at,
        invoice: r.order_number,
        order_id: r.order_id,
        customer: r.customer_name,
        sales_amount: Number(r.subtotal),
        discount: Number(r.discount_amount),
        tax: Number(r.tax_amount),
        paid,
        outstanding: round2(Math.max(0, total - paid)),
        payment_method: r.provider || "—",
        net_sales: total,
        payment_status: r.payment_status,
        channel: r.channel
      };
    })
  };
}

export async function buildPurchaseFinanceReport(filters: { from?: string; to?: string } = {}) {
  await ensureFinanceSchema();
  const rows = await listFinanceEntries({
    direction: "out",
    category: "purchase",
    from: filters.from,
    to: filters.to,
    limit: 500
  });
  return {
    from: filters.from || null,
    to: filters.to || null,
    rows: rows.map((r) => ({
      date: r.entry_date,
      purchase_invoice: r.reference_no || r.entry_no,
      entry_no: r.entry_no,
      supplier: r.counterparty_name,
      purchase_amount: Number(r.amount),
      tax: Number(r.tax_amount || 0),
      paid: r.status === "cleared" ? Number(r.amount) : 0,
      outstanding: r.status === "pending" ? Number(r.amount) : 0,
      payment_method: r.payment_method,
      status: r.status
    }))
  };
}

export async function buildExpenseReport(filters: { from?: string; to?: string } = {}) {
  await ensureFinanceSchema();
  const expenseCats = [
    "expense",
    "salary",
    "rent",
    "utilities",
    "logistics",
    "packaging",
    "marketing",
    "maintenance",
    "tax",
    "other"
  ];
  const rows = await listFinanceEntries({
    direction: "out",
    status: "cleared",
    from: filters.from,
    to: filters.to,
    limit: 500
  });
  const filtered = rows.filter((r) => expenseCats.includes(String(r.category)));
  const byCategory = new Map<string, number>();
  for (const row of filtered) {
    byCategory.set(row.category, round2((byCategory.get(row.category) || 0) + Number(row.amount)));
  }
  return {
    from: filters.from || null,
    to: filters.to || null,
    rows: filtered.map((r) => ({
      date: r.entry_date,
      entry_no: r.entry_no,
      category: r.category,
      description: r.notes || r.counterparty_name || "—",
      amount: Number(r.amount),
      tax: Number(r.tax_amount || 0),
      total: Number(r.amount),
      payment_method: r.payment_method
    })),
    by_category: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  };
}

/** Boutique: sales split by payment method (from payments table). */
export async function buildSalesByPaymentMethod(filters: { from?: string; to?: string } = {}) {
  await ensureFinanceSchema();
  const range = {
    from: filters.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: filters.to || new Date().toISOString().slice(0, 10)
  };
  const rows = await query<{ provider: string; total: string; count: string }>(
    `select coalesce(p.provider, 'other') as provider,
            coalesce(sum(p.amount),0)::text as total,
            count(*)::text as count
     from payments p
     join orders o on o.id = p.order_id
     where p.status = 'paid'
       and p.created_at::date between $1::date and $2::date
       and coalesce(o.status,'') not in ('cancelled')
     group by coalesce(p.provider, 'other')
     order by sum(p.amount) desc`,
    [range.from, range.to]
  );
  return {
    from: range.from,
    to: range.to,
    rows: rows.map((r) => ({
      payment_method: r.provider,
      orders: Number(r.count),
      amount: Number(r.total)
    }))
  };
}

/** Boutique: sales by product / category from paid order lines. */
export async function buildSalesByProduct(filters: { from?: string; to?: string } = {}) {
  await ensureFinanceSchema();
  const range = {
    from: filters.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: filters.to || new Date().toISOString().slice(0, 10)
  };
  const rows = await query<{
    product_name: string;
    category_name: string | null;
    qty: string;
    amount: string;
  }>(
    `select coalesce(p.name, oi.product_name, 'Item') as product_name,
            coalesce(c.name, 'Uncategorised') as category_name,
            coalesce(sum(oi.quantity),0)::text as qty,
            coalesce(sum(oi.line_total),0)::text as amount
     from order_items oi
     join orders o on o.id = oi.order_id
     left join products p on p.id = oi.product_id
     left join categories c on c.id = p.category_id
     where o.payment_status = 'paid'
       and o.created_at::date between $1::date and $2::date
       and coalesce(o.status,'') not in ('cancelled')
     group by coalesce(p.name, oi.product_name, 'Item'), coalesce(c.name, 'Uncategorised')
     order by sum(oi.line_total) desc
     limit 200`,
    [range.from, range.to]
  ).catch(() => []);

  const byCategory = new Map<string, number>();
  for (const row of rows) {
    const cat = row.category_name || "Uncategorised";
    byCategory.set(cat, round2((byCategory.get(cat) || 0) + Number(row.amount)));
  }

  return {
    from: range.from,
    to: range.to,
    rows: rows.map((r) => ({
      product: r.product_name,
      category: r.category_name,
      qty: Number(r.qty),
      amount: Number(r.amount)
    })),
    by_category: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  };
}

/** Boutique: returns & refunds from existing order_returns. */
export async function buildReturnsRefundReport(filters: { from?: string; to?: string } = {}) {
  await ensureFinanceSchema();
  const params: unknown[] = [];
  const where = [`1=1`];
  if (filters.from) {
    params.push(filters.from);
    where.push(`r.created_at::date >= $${params.length}::date`);
  }
  if (filters.to) {
    params.push(filters.to);
    where.push(`r.created_at::date <= $${params.length}::date`);
  }
  const rows = await query<{
    id: string;
    order_number: string;
    status: string;
    refund_amount: string;
    created_at: string;
    customer_name: string | null;
  }>(
    `select r.id, o.order_number, r.status, coalesce(r.refund_amount,0)::text as refund_amount, r.created_at,
            coalesce(nullif(o.pos_customer_name,''), c.full_name, '—') as customer_name
     from order_returns r
     join orders o on o.id = r.order_id
     left join customers c on c.id = o.customer_id
     where ${where.join(" and ")}
     order by r.created_at desc
     limit 300`,
    params
  );
  return {
    from: filters.from || null,
    to: filters.to || null,
    rows: rows.map((r) => ({
      date: r.created_at,
      order: r.order_number,
      customer: r.customer_name,
      status: r.status,
      refund_amount: Number(r.refund_amount)
    })),
    total_refunded: round2(
      rows.filter((r) => r.status === "refunded").reduce((s, r) => s + Number(r.refund_amount), 0)
    )
  };
}

/** Boutique: payment register from payments + finance. */
export async function buildPaymentReport(filters: { from?: string; to?: string } = {}) {
  await ensureFinanceSchema();
  const range = {
    from: filters.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: filters.to || new Date().toISOString().slice(0, 10)
  };
  const rows = await query<{
    created_at: string;
    order_number: string;
    provider: string;
    amount: string;
    status: string;
    channel: string;
    customer_name: string | null;
  }>(
    `select p.created_at, o.order_number, p.provider, p.amount, p.status,
            coalesce(o.channel,'online') as channel,
            coalesce(nullif(o.pos_customer_name,''), c.full_name, '—') as customer_name
     from payments p
     join orders o on o.id = p.order_id
     left join customers c on c.id = o.customer_id
     where p.created_at::date between $1::date and $2::date
     order by p.created_at desc
     limit 500`,
    [range.from, range.to]
  );
  return {
    from: range.from,
    to: range.to,
    rows: rows.map((r) => ({
      date: r.created_at,
      order: r.order_number,
      customer: r.customer_name,
      channel: r.channel,
      method: r.provider,
      amount: Number(r.amount),
      status: r.status
    }))
  };
}

/** Optional GST snapshot — only if orders already store tax_amount. */
export async function buildTaxSummary(filters: { from?: string; to?: string } = {}) {
  await ensureFinanceSchema();
  const range = {
    from: filters.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: filters.to || new Date().toISOString().slice(0, 10)
  };
  const output = await queryOne<{ total: string }>(
    `select coalesce(sum(tax_amount),0)::text as total
     from orders
     where payment_status = 'paid' and created_at::date between $1::date and $2::date`,
    [range.from, range.to]
  );
  return {
    from: range.from,
    to: range.to,
    tax_collected_on_sales: Number(output?.total || 0),
    note: "Reuses existing order tax_amount from billing — not a separate GST engine."
  };
}

export type { PnLSummary };
