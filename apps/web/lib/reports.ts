import { query, queryOne } from "./db/pool";
import { ensureFinanceSchema, buildProfitAndLoss } from "./finance";
import {
  buildExpenseReport,
  listPayables,
  listReceivables
} from "./finance-reports";
import type { ReportType } from "./report-catalog";
import { ensureSuppliersSchema } from "./suppliers";

export type { ReportType };
export { REPORT_CATALOG } from "./report-catalog";

const LOW_STOCK = 10;

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function defaultRange(from?: string, to?: string) {
  const end = to || new Date().toISOString().slice(0, 10);
  const start =
    from ||
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  return { from: start, to: end };
}

function clampPage(page?: number, pageSize?: number) {
  const p = Number.isFinite(page) && (page as number) > 0 ? Math.floor(page as number) : 1;
  const sizeRaw = Number.isFinite(pageSize) ? Math.floor(pageSize as number) : 50;
  const size = Math.min(Math.max(sizeRaw, 1), 200);
  return { page: p, pageSize: size, offset: (p - 1) * size };
}

export type ReportColumn = {
  key: string;
  label: string;
  format?: "money" | "date" | "number" | "text";
};

export type ReportResult = {
  type: string;
  title: string;
  from: string | null;
  to: string | null;
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
  summary: Record<string, number | string>;
  pagination: { page: number; pageSize: number; total: number; total_pages: number };
  notes?: string[];
  links?: Array<{ label: string; href: string }>;
};

export type ReportFilters = {
  from?: string;
  to?: string;
  q?: string;
  customer?: string;
  product?: string;
  category?: string;
  payment_method?: string;
  order_status?: string;
  payment_status?: string;
  stock_status?: "all" | "low" | "out" | "in";
  page?: number;
  pageSize?: number;
  sort?: string;
  dir?: "asc" | "desc";
};

function paginateResult(
  type: string,
  title: string,
  range: { from: string | null; to: string | null },
  columns: ReportColumn[],
  allRows: Array<Record<string, unknown>>,
  summary: Record<string, number | string>,
  page: number,
  pageSize: number,
  extras?: Partial<ReportResult>
): ReportResult {
  const total = allRows.length;
  const total_pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    type,
    title,
    from: range.from,
    to: range.to,
    columns,
    rows: allRows.slice(start, start + pageSize),
    summary,
    pagination: { page, pageSize, total, total_pages },
    ...extras
  };
}

function normalizePaymentMethod(provider: string | null | undefined) {
  const p = (provider || "other").toLowerCase();
  if (p === "cash" || p === "pos_cash") return "Cash";
  if (p === "upi") return "UPI";
  if (p === "card") return "Card";
  if (p === "razorpay" || p === "online") return "Online payment";
  if (p === "bank") return "Bank";
  return provider || "Other";
}

/** 1. Sales report — order lines aggregated per invoice with product summary. */
export async function buildSalesReport(filters: ReportFilters = {}): Promise<ReportResult> {
  const range = defaultRange(filters.from, filters.to);
  const { page, pageSize } = clampPage(filters.page, filters.pageSize);
  const params: unknown[] = [range.from, range.to];
  const where = [
    `o.created_at::date between $1::date and $2::date`,
    `coalesce(o.status,'') not in ('cancelled')`
  ];

  if (filters.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    where.push(
      `(o.order_number ilike $${params.length} or coalesce(o.pos_customer_name,'') ilike $${params.length} or coalesce(c.full_name,'') ilike $${params.length})`
    );
  }
  if (filters.customer?.trim()) {
    params.push(`%${filters.customer.trim()}%`);
    where.push(
      `(coalesce(o.pos_customer_name,'') ilike $${params.length} or coalesce(c.full_name,'') ilike $${params.length} or o.customer_id::text = $${params.length})`
    );
  }
  if (filters.payment_method?.trim()) {
    params.push(filters.payment_method.trim().toLowerCase());
    where.push(
      `exists (select 1 from payments p where p.order_id = o.id and p.status = 'paid' and lower(coalesce(p.provider,'other')) = $${params.length})`
    );
  }
  if (filters.order_status?.trim()) {
    params.push(filters.order_status.trim().toLowerCase());
    where.push(`lower(coalesce(o.status,'')) = $${params.length}`);
  }
  if (filters.payment_status?.trim()) {
    params.push(filters.payment_status.trim().toLowerCase());
    where.push(`lower(coalesce(o.payment_status,'')) = $${params.length}`);
  }
  if (filters.product?.trim()) {
    params.push(`%${filters.product.trim()}%`);
    where.push(
      `exists (
        select 1 from order_items oi
        left join products pr on pr.id = oi.product_id
        where oi.order_id = o.id
          and (oi.product_name ilike $${params.length} or coalesce(pr.name,'') ilike $${params.length} or coalesce(oi.sku,'') ilike $${params.length})
      )`
    );
  }
  if (filters.category?.trim()) {
    params.push(`%${filters.category.trim()}%`);
    where.push(
      `exists (
        select 1 from order_items oi
        join products pr on pr.id = oi.product_id
        left join categories cat on cat.id = pr.category_id
        where oi.order_id = o.id and coalesce(cat.name,'') ilike $${params.length}
      )`
    );
  }

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
    status: string;
    paid_sum: string;
    provider: string | null;
    products: string | null;
    quantity: string;
  }>(
    `select o.id as order_id, o.order_number, o.created_at, o.subtotal, o.discount_amount, o.tax_amount,
            o.total_amount, o.payment_status, coalesce(o.status,'') as status,
            coalesce(nullif(o.pos_customer_name,''), c.full_name, 'Walk-in') as customer_name,
            coalesce((select sum(p.amount) from payments p where p.order_id = o.id and p.status = 'paid'),0)::text as paid_sum,
            (select p.provider from payments p where p.order_id = o.id and p.status = 'paid' order by p.created_at desc limit 1) as provider,
            (select string_agg(distinct coalesce(pr.name, oi.product_name), ', ')
               from order_items oi left join products pr on pr.id = oi.product_id
              where oi.order_id = o.id) as products,
            coalesce((select sum(oi.quantity) from order_items oi where oi.order_id = o.id),0)::text as quantity
     from orders o
     left join customers c on c.id = o.customer_id
     where ${where.join(" and ")}
     order by o.created_at desc
     limit 2000`,
    params
  );

  const mapped = rows.map((r) => {
    const gross = Number(r.subtotal);
    const discount = Number(r.discount_amount);
    const tax = Number(r.tax_amount);
    const net = Number(r.total_amount);
    const paid = Number(r.paid_sum);
    return {
      date: r.created_at,
      invoice: r.order_number,
      customer: r.customer_name,
      products: r.products || "—",
      quantity: Number(r.quantity),
      gross_amount: gross,
      discount,
      tax,
      net_amount: net,
      paid_amount: paid,
      payment_method: normalizePaymentMethod(r.provider),
      order_status: r.status || "—",
      payment_status: r.payment_status
    };
  });

  const summary = {
    invoices: mapped.length,
    quantity: mapped.reduce((s, r) => s + Number(r.quantity), 0),
    gross_amount: round2(mapped.reduce((s, r) => s + Number(r.gross_amount), 0)),
    discount: round2(mapped.reduce((s, r) => s + Number(r.discount), 0)),
    tax: round2(mapped.reduce((s, r) => s + Number(r.tax), 0)),
    net_amount: round2(mapped.reduce((s, r) => s + Number(r.net_amount), 0)),
    paid_amount: round2(mapped.reduce((s, r) => s + Number(r.paid_amount), 0))
  };

  return paginateResult(
    "sales",
    "Sales report",
    range,
    [
      { key: "date", label: "Date", format: "date" },
      { key: "invoice", label: "Invoice / Order" },
      { key: "customer", label: "Customer" },
      { key: "products", label: "Products" },
      { key: "quantity", label: "Qty", format: "number" },
      { key: "gross_amount", label: "Gross", format: "money" },
      { key: "discount", label: "Discount", format: "money" },
      { key: "tax", label: "Tax", format: "money" },
      { key: "net_amount", label: "Net", format: "money" },
      { key: "paid_amount", label: "Paid", format: "money" },
      { key: "payment_method", label: "Payment method" },
      { key: "order_status", label: "Order status" }
    ],
    mapped,
    summary,
    page,
    pageSize
  );
}

/** 11. Order report */
export async function buildOrderReport(filters: ReportFilters = {}): Promise<ReportResult> {
  const range = defaultRange(filters.from, filters.to);
  const { page, pageSize } = clampPage(filters.page, filters.pageSize);
  const params: unknown[] = [range.from, range.to];
  const where = [`o.created_at::date between $1::date and $2::date`];

  if (filters.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    where.push(
      `(o.order_number ilike $${params.length} or coalesce(c.full_name,'') ilike $${params.length} or coalesce(o.pos_customer_name,'') ilike $${params.length})`
    );
  }
  if (filters.order_status?.trim()) {
    params.push(filters.order_status.trim().toLowerCase());
    where.push(`lower(coalesce(o.status,'')) = $${params.length}`);
  }
  if (filters.payment_status?.trim()) {
    params.push(filters.payment_status.trim().toLowerCase());
    where.push(`lower(coalesce(o.payment_status,'')) = $${params.length}`);
  }
  if (filters.payment_method?.trim()) {
    params.push(filters.payment_method.trim().toLowerCase());
    where.push(
      `exists (select 1 from payments p where p.order_id = o.id and p.status = 'paid' and lower(coalesce(p.provider,'other')) = $${params.length})`
    );
  }

  const rows = await query<{
    order_number: string;
    created_at: string;
    customer_name: string | null;
    total_amount: string;
    payment_status: string;
    status: string;
    channel: string;
    provider: string | null;
  }>(
    `select o.order_number, o.created_at, o.total_amount, o.payment_status, coalesce(o.status,'') as status,
            coalesce(o.channel,'online') as channel,
            coalesce(nullif(o.pos_customer_name,''), c.full_name, 'Walk-in') as customer_name,
            (select p.provider from payments p where p.order_id = o.id and p.status = 'paid' order by p.created_at desc limit 1) as provider
     from orders o
     left join customers c on c.id = o.customer_id
     where ${where.join(" and ")}
     order by o.created_at desc
     limit 2000`,
    params
  );

  const mapped = rows.map((r) => ({
    order_number: r.order_number,
    date: r.created_at,
    customer: r.customer_name,
    order_value: Number(r.total_amount),
    payment_status: r.payment_status,
    order_status: r.status || "—",
    delivery_status: r.status || "—",
    payment_method: normalizePaymentMethod(r.provider),
    channel: r.channel
  }));

  return paginateResult(
    "orders",
    "Order report",
    range,
    [
      { key: "order_number", label: "Order number" },
      { key: "date", label: "Date", format: "date" },
      { key: "customer", label: "Customer" },
      { key: "order_value", label: "Order value", format: "money" },
      { key: "payment_status", label: "Payment status" },
      { key: "order_status", label: "Order status" },
      { key: "delivery_status", label: "Delivery status" },
      { key: "payment_method", label: "Payment method" }
    ],
    mapped,
    {
      orders: mapped.length,
      order_value: round2(mapped.reduce((s, r) => s + Number(r.order_value), 0))
    },
    page,
    pageSize,
    {
      notes: [
        "Delivery status uses the existing order status field (no separate delivery column in schema)."
      ]
    }
  );
}

/** 2. Purchase report from GRN audit lines + finance paid/outstanding. */
export async function buildPurchaseReport(filters: ReportFilters = {}): Promise<ReportResult> {
  await ensureFinanceSchema();
  await ensureSuppliersSchema();
  const range = defaultRange(filters.from, filters.to);
  const { page, pageSize } = clampPage(filters.page, filters.pageSize);
  const params: unknown[] = [range.from, range.to];
  const where = [
    `a.action = 'inventory_inward'`,
    `a.entity_type = 'inventory_movements'`,
    `a.created_at::date between $1::date and $2::date`
  ];
  if (filters.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    where.push(
      `(coalesce(a.after->>'supplier','') ilike $${params.length} or coalesce(a.after->>'billNo','') ilike $${params.length})`
    );
  }

  const rows = await query<{
    created_at: string;
    bill_no: string | null;
    supplier: string | null;
    product: string | null;
    quantity: string;
    purchase_amount: string;
    invoice_amount: string | null;
  }>(
    `select a.created_at,
            nullif(a.after->>'billNo','') as bill_no,
            coalesce(nullif(a.after->>'supplier',''), s.name, 'Supplier') as supplier,
            coalesce(p.name, pv.name, 'Item') as product,
            coalesce(nullif(line->>'unitsCreated','')::numeric, 0)::text as quantity,
            coalesce(nullif(line->>'lineTotal','')::numeric, 0)::text as purchase_amount,
            nullif(a.after->>'invoiceAmount','') as invoice_amount
     from audit_logs a
     left join lateral jsonb_array_elements(coalesce(a.after->'lines', '[]'::jsonb)) as line on true
     left join product_variants pv on pv.id = nullif(line->>'productVariantId','')::uuid
     left join products p on p.id = pv.product_id
     left join suppliers s on s.id = nullif(a.after->>'supplierId','')::uuid
     where ${where.join(" and ")}
     order by a.created_at desc
     limit 2000`,
    params
  ).catch(() => []);

  // Fallback: finance purchase entries when no GRN audit lines
  if (!rows.length) {
    const entries = await query<{
      entry_date: string;
      reference_no: string | null;
      entry_no: string;
      counterparty_name: string | null;
      amount: string;
      tax_amount: string;
      status: string;
    }>(
      `select entry_date, reference_no, entry_no, counterparty_name, amount::text, coalesce(tax_amount,0)::text as tax_amount, status
       from finance_payment_entries
       where direction = 'out' and category = 'purchase'
         and entry_date between $1::date and $2::date
       order by entry_date desc
       limit 1000`,
      [range.from, range.to]
    );
    const mapped = entries.map((r) => {
      const amount = Number(r.amount);
      const tax = Number(r.tax_amount);
      const paid = r.status === "cleared" ? amount : 0;
      const outstanding = r.status === "pending" ? amount : 0;
      return {
        date: r.entry_date,
        purchase_invoice: r.reference_no || r.entry_no,
        supplier: r.counterparty_name || "—",
        products: "—",
        quantity: 0,
        purchase_amount: round2(amount - tax),
        tax,
        total: amount,
        paid,
        outstanding
      };
    });
    return paginateResult(
      "purchases",
      "Purchase report",
      range,
      [
        { key: "date", label: "Date", format: "date" },
        { key: "purchase_invoice", label: "Purchase invoice" },
        { key: "supplier", label: "Supplier" },
        { key: "products", label: "Products" },
        { key: "quantity", label: "Qty", format: "number" },
        { key: "purchase_amount", label: "Purchase amount", format: "money" },
        { key: "tax", label: "Tax", format: "money" },
        { key: "total", label: "Total", format: "money" },
        { key: "paid", label: "Paid", format: "money" },
        { key: "outstanding", label: "Outstanding", format: "money" }
      ],
      mapped,
      {
        lines: mapped.length,
        total: round2(mapped.reduce((s, r) => s + Number(r.total), 0)),
        paid: round2(mapped.reduce((s, r) => s + Number(r.paid), 0)),
        outstanding: round2(mapped.reduce((s, r) => s + Number(r.outstanding), 0))
      },
      page,
      pageSize,
      { notes: ["Showing finance purchase entries (no GRN line detail in range)."] }
    );
  }

  // Finance paid map by bill no
  const finance = await query<{
    reference_no: string | null;
    amount: string;
    status: string;
  }>(
    `select reference_no, amount::text, status
     from finance_payment_entries
     where direction = 'out' and category = 'purchase'
       and entry_date between $1::date and $2::date`,
    [range.from, range.to]
  ).catch(() => []);

  const financeByBill = new Map<string, { paid: number; outstanding: number; total: number }>();
  for (const f of finance) {
    const key = (f.reference_no || "").trim();
    if (!key) continue;
    const amount = Number(f.amount);
    const cur = financeByBill.get(key) || { paid: 0, outstanding: 0, total: 0 };
    cur.total = round2(cur.total + amount);
    if (f.status === "cleared") cur.paid = round2(cur.paid + amount);
    else cur.outstanding = round2(cur.outstanding + amount);
    financeByBill.set(key, cur);
  }

  const mapped = rows.map((r) => {
    const bill = r.bill_no || "—";
    const lineTotal = Number(r.purchase_amount);
    const fin = r.bill_no ? financeByBill.get(r.bill_no) : undefined;
    const invoiceTotal = Number(r.invoice_amount || lineTotal);
    return {
      date: r.created_at,
      purchase_invoice: bill,
      supplier: r.supplier || "—",
      products: r.product || "—",
      quantity: Number(r.quantity),
      purchase_amount: lineTotal,
      tax: 0,
      total: lineTotal,
      paid: fin ? fin.paid : 0,
      outstanding: fin ? fin.outstanding : invoiceTotal,
      _invoice_total: invoiceTotal
    };
  });

  return paginateResult(
    "purchases",
    "Purchase report",
    range,
    [
      { key: "date", label: "Date", format: "date" },
      { key: "purchase_invoice", label: "Purchase invoice" },
      { key: "supplier", label: "Supplier" },
      { key: "products", label: "Products" },
      { key: "quantity", label: "Qty", format: "number" },
      { key: "purchase_amount", label: "Purchase amount", format: "money" },
      { key: "tax", label: "Tax", format: "money" },
      { key: "total", label: "Total", format: "money" },
      { key: "paid", label: "Paid", format: "money" },
      { key: "outstanding", label: "Outstanding", format: "money" }
    ],
    mapped.map(({ _invoice_total: _, ...rest }) => rest),
    {
      lines: mapped.length,
      quantity: mapped.reduce((s, r) => s + Number(r.quantity), 0),
      purchase_amount: round2(mapped.reduce((s, r) => s + Number(r.purchase_amount), 0)),
      paid: round2([...financeByBill.values()].reduce((s, r) => s + r.paid, 0)),
      outstanding: round2([...financeByBill.values()].reduce((s, r) => s + r.outstanding, 0))
    },
    page,
    pageSize
  );
}

/** 3. Product sales */
export async function buildProductSalesReport(filters: ReportFilters = {}): Promise<ReportResult> {
  const range = defaultRange(filters.from, filters.to);
  const { page, pageSize } = clampPage(filters.page, filters.pageSize);
  const params: unknown[] = [range.from, range.to];
  const where = [
    `o.payment_status = 'paid'`,
    `o.created_at::date between $1::date and $2::date`,
    `coalesce(o.status,'') not in ('cancelled')`
  ];
  if (filters.product?.trim() || filters.q?.trim()) {
    const term = (filters.product || filters.q || "").trim();
    params.push(`%${term}%`);
    where.push(
      `(coalesce(p.name, oi.product_name) ilike $${params.length} or coalesce(oi.sku,'') ilike $${params.length})`
    );
  }
  if (filters.category?.trim()) {
    params.push(`%${filters.category.trim()}%`);
    where.push(`coalesce(c.name,'') ilike $${params.length}`);
  }

  const rows = await query<{
    product_id: string | null;
    product_name: string;
    category_name: string | null;
    qty: string;
    sales: string;
    discount_share: string;
    returns_qty: string;
    returns_amount: string;
  }>(
    `select oi.product_id,
            coalesce(p.name, oi.product_name, 'Item') as product_name,
            coalesce(c.name, 'Uncategorised') as category_name,
            coalesce(sum(oi.quantity),0)::text as qty,
            coalesce(sum(oi.line_total),0)::text as sales,
            coalesce(sum(
              case when o.subtotal > 0
                then (oi.line_total / o.subtotal) * coalesce(o.discount_amount,0)
                else 0 end
            ),0)::text as discount_share,
            coalesce((
              select sum(ri.quantity)
              from return_items ri
              join order_returns r on r.id = ri.return_id
              join order_items roi on roi.id = ri.order_item_id
              where roi.product_id = oi.product_id
                and r.created_at::date between $1::date and $2::date
                and r.status in ('approved','refunded','received')
            ),0)::text as returns_qty,
            coalesce((
              select sum(
                case when oi2.quantity > 0
                  then (ri.quantity::numeric / oi2.quantity) * oi2.line_total
                  else 0 end
              )
              from return_items ri
              join order_returns r on r.id = ri.return_id
              join order_items oi2 on oi2.id = ri.order_item_id
              where oi2.product_id = oi.product_id
                and r.created_at::date between $1::date and $2::date
                and r.status in ('approved','refunded','received')
            ),0)::text as returns_amount
     from order_items oi
     join orders o on o.id = oi.order_id
     left join products p on p.id = oi.product_id
     left join categories c on c.id = p.category_id
     where ${where.join(" and ")}
     group by oi.product_id, coalesce(p.name, oi.product_name, 'Item'), coalesce(c.name, 'Uncategorised')
     order by sum(oi.line_total) desc
     limit 1000`,
    params
  ).catch(() => []);

  const mapped = rows.map((r) => {
    const sales = Number(r.sales);
    const discount = Number(r.discount_share);
    const returns = Number(r.returns_amount);
    return {
      product: r.product_name,
      category: r.category_name,
      quantity_sold: Number(r.qty),
      total_sales: round2(sales),
      discount: round2(discount),
      returns: round2(returns),
      net_sales: round2(sales - discount - returns)
    };
  });

  return paginateResult(
    "product_sales",
    "Product sales report",
    range,
    [
      { key: "product", label: "Product" },
      { key: "category", label: "Category" },
      { key: "quantity_sold", label: "Qty sold", format: "number" },
      { key: "total_sales", label: "Total sales", format: "money" },
      { key: "discount", label: "Discount", format: "money" },
      { key: "returns", label: "Returns", format: "money" },
      { key: "net_sales", label: "Net sales", format: "money" }
    ],
    mapped,
    {
      products: mapped.length,
      quantity_sold: mapped.reduce((s, r) => s + Number(r.quantity_sold), 0),
      total_sales: round2(mapped.reduce((s, r) => s + Number(r.total_sales), 0)),
      discount: round2(mapped.reduce((s, r) => s + Number(r.discount), 0)),
      returns: round2(mapped.reduce((s, r) => s + Number(r.returns), 0)),
      net_sales: round2(mapped.reduce((s, r) => s + Number(r.net_sales), 0))
    },
    page,
    pageSize
  );
}

/** 4. Category sales */
export async function buildCategorySalesReport(filters: ReportFilters = {}): Promise<ReportResult> {
  const range = defaultRange(filters.from, filters.to);
  const { page, pageSize } = clampPage(filters.page, filters.pageSize);
  const params: unknown[] = [range.from, range.to];
  const where = [
    `o.payment_status = 'paid'`,
    `o.created_at::date between $1::date and $2::date`,
    `coalesce(o.status,'') not in ('cancelled')`
  ];
  if (filters.category?.trim() || filters.q?.trim()) {
    params.push(`%${(filters.category || filters.q || "").trim()}%`);
    where.push(`coalesce(c.name,'Uncategorised') ilike $${params.length}`);
  }

  const rows = await query<{
    category_name: string;
    orders: string;
    qty: string;
    gross: string;
    discount: string;
    returns_amount: string;
  }>(
    `select coalesce(c.name, 'Uncategorised') as category_name,
            count(distinct o.id)::text as orders,
            coalesce(sum(oi.quantity),0)::text as qty,
            coalesce(sum(oi.line_total),0)::text as gross,
            coalesce(sum(
              case when o.subtotal > 0
                then (oi.line_total / o.subtotal) * coalesce(o.discount_amount,0)
                else 0 end
            ),0)::text as discount,
            coalesce((
              select sum(
                case when oi2.quantity > 0
                  then (ri.quantity::numeric / oi2.quantity) * oi2.line_total
                  else 0 end
              )
              from return_items ri
              join order_returns r on r.id = ri.return_id
              join order_items oi2 on oi2.id = ri.order_item_id
              join products p2 on p2.id = oi2.product_id
              left join categories c2 on c2.id = p2.category_id
              where coalesce(c2.name, 'Uncategorised') = coalesce(c.name, 'Uncategorised')
                and r.created_at::date between $1::date and $2::date
                and r.status in ('approved','refunded','received')
            ),0)::text as returns_amount
     from order_items oi
     join orders o on o.id = oi.order_id
     left join products p on p.id = oi.product_id
     left join categories c on c.id = p.category_id
     where ${where.join(" and ")}
     group by coalesce(c.name, 'Uncategorised')
     order by sum(oi.line_total) desc`,
    params
  ).catch(() => []);

  const mapped = rows.map((r) => {
    const gross = Number(r.gross);
    const discount = Number(r.discount);
    const returns = Number(r.returns_amount);
    return {
      category: r.category_name,
      orders: Number(r.orders),
      quantity_sold: Number(r.qty),
      gross_sales: round2(gross),
      discounts: round2(discount),
      returns: round2(returns),
      net_sales: round2(gross - discount - returns)
    };
  });

  return paginateResult(
    "category_sales",
    "Category sales report",
    range,
    [
      { key: "category", label: "Category" },
      { key: "orders", label: "Orders", format: "number" },
      { key: "quantity_sold", label: "Qty sold", format: "number" },
      { key: "gross_sales", label: "Gross sales", format: "money" },
      { key: "discounts", label: "Discounts", format: "money" },
      { key: "returns", label: "Returns", format: "money" },
      { key: "net_sales", label: "Net sales", format: "money" }
    ],
    mapped,
    {
      categories: mapped.length,
      gross_sales: round2(mapped.reduce((s, r) => s + Number(r.gross_sales), 0)),
      net_sales: round2(mapped.reduce((s, r) => s + Number(r.net_sales), 0))
    },
    page,
    pageSize
  );
}

/** 5. Payment report — collections by method + refunds */
export async function buildCollectionsReport(filters: ReportFilters = {}): Promise<ReportResult> {
  const range = defaultRange(filters.from, filters.to);
  const { page, pageSize } = clampPage(filters.page, filters.pageSize);

  const collected = await query<{ provider: string; total: string; count: string }>(
    `select coalesce(p.provider, 'other') as provider,
            coalesce(sum(p.amount),0)::text as total,
            count(*)::text as count
     from payments p
     join orders o on o.id = p.order_id
     where p.status = 'paid'
       and p.created_at::date between $1::date and $2::date
       and coalesce(o.status,'') not in ('cancelled')
     group by coalesce(p.provider, 'other')`,
    [range.from, range.to]
  );

  const refunds = await queryOne<{ total: string; count: string }>(
    `select coalesce(sum(refund_amount),0)::text as total, count(*)::text as count
     from order_returns
     where status = 'refunded'
       and coalesce(updated_at, created_at)::date between $1::date and $2::date`,
    [range.from, range.to]
  ).catch(() => ({ total: "0", count: "0" }));

  const byMethod = new Map<string, { count: number; total: number }>();
  for (const row of collected) {
    const label = normalizePaymentMethod(row.provider);
    const cur = byMethod.get(label) || { count: 0, total: 0 };
    cur.count += Number(row.count);
    cur.total = round2(cur.total + Number(row.total));
    byMethod.set(label, cur);
  }

  const refundTotal = Number(refunds?.total || 0);
  const collectionTotal = [...byMethod.values()].reduce((s, r) => s + r.total, 0);
  // Allocate refunds proportionally for net by method (display total refunds in summary)
  const mapped = [...byMethod.entries()]
    .map(([method, v]) => {
      const share = collectionTotal > 0 ? v.total / collectionTotal : 0;
      const methodRefunds = round2(refundTotal * share);
      return {
        payment_method: method,
        transaction_count: v.count,
        total_amount: v.total,
        refunds: methodRefunds,
        net_collection: round2(v.total - methodRefunds)
      };
    })
    .sort((a, b) => b.total_amount - a.total_amount);

  if (filters.payment_method?.trim()) {
    const want = filters.payment_method.trim().toLowerCase();
    const filtered = mapped.filter((r) => r.payment_method.toLowerCase().includes(want));
    return paginateResult(
      "payments",
      "Payment report",
      range,
      [
        { key: "payment_method", label: "Payment method" },
        { key: "transaction_count", label: "Transactions", format: "number" },
        { key: "total_amount", label: "Total amount", format: "money" },
        { key: "refunds", label: "Refunds", format: "money" },
        { key: "net_collection", label: "Net collection", format: "money" }
      ],
      filtered,
      {
        transaction_count: filtered.reduce((s, r) => s + r.transaction_count, 0),
        total_amount: round2(filtered.reduce((s, r) => s + r.total_amount, 0)),
        refunds: refundTotal,
        net_collection: round2(filtered.reduce((s, r) => s + r.net_collection, 0))
      },
      page,
      pageSize
    );
  }

  return paginateResult(
    "payments",
    "Payment report",
    range,
    [
      { key: "payment_method", label: "Payment method" },
      { key: "transaction_count", label: "Transactions", format: "number" },
      { key: "total_amount", label: "Total amount", format: "money" },
      { key: "refunds", label: "Refunds", format: "money" },
      { key: "net_collection", label: "Net collection", format: "money" }
    ],
    mapped,
    {
      transaction_count: mapped.reduce((s, r) => s + r.transaction_count, 0),
      total_amount: round2(collectionTotal),
      refunds: refundTotal,
      net_collection: round2(collectionTotal - refundTotal)
    },
    page,
    pageSize,
    {
      notes: [
        "Refunds are allocated across payment methods in proportion to collections (refunds are stored on returns, not per payment provider)."
      ]
    }
  );
}

/** 6. Expense report — reuse finance builder */
export async function buildExpenseReportDetailed(filters: ReportFilters = {}): Promise<ReportResult> {
  const range = defaultRange(filters.from, filters.to);
  const { page, pageSize } = clampPage(filters.page, filters.pageSize);
  const data = await buildExpenseReport({ from: range.from, to: range.to });
  let rows = data.rows as Array<Record<string, unknown>>;
  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        String(r.category || "")
          .toLowerCase()
          .includes(q) ||
        String(r.description || "")
          .toLowerCase()
          .includes(q)
    );
  }
  const byCategory = (data.by_category || []) as Array<{ category: string; amount: number }>;
  return paginateResult(
    "expenses",
    "Expense report",
    range,
    [
      { key: "date", label: "Date", format: "date" },
      { key: "category", label: "Expense category" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", format: "money" },
      { key: "payment_method", label: "Payment method" }
    ],
    rows.map((r) => ({
      date: r.date,
      category: r.category,
      description: r.description,
      amount: r.amount,
      payment_method: r.payment_method
    })),
    {
      entries: rows.length,
      amount: round2(rows.reduce((s, r) => s + Number(r.amount || 0), 0)),
      ...Object.fromEntries(byCategory.map((c) => [`cat_${c.category}`, c.amount]))
    },
    page,
    pageSize,
    {
      notes: byCategory.map((c) => `${c.category}: ₹${c.amount.toFixed(2)}`),
      links: [{ label: "Finance → Expenses", href: "/admin/finance/expenses" }]
    }
  );
}

/** 7. Customer report */
export async function buildCustomerReport(filters: ReportFilters = {}): Promise<ReportResult> {
  const range = defaultRange(filters.from, filters.to);
  const { page, pageSize } = clampPage(filters.page, filters.pageSize);
  const params: unknown[] = [range.from, range.to];
  const where = [
    `o.created_at::date between $1::date and $2::date`,
    `coalesce(o.status,'') not in ('cancelled')`
  ];
  if (filters.q?.trim() || filters.customer?.trim()) {
    params.push(`%${(filters.q || filters.customer || "").trim()}%`);
    where.push(
      `(coalesce(c.full_name,'') ilike $${params.length} or coalesce(o.pos_customer_name,'') ilike $${params.length} or coalesce(c.phone,'') ilike $${params.length})`
    );
  }

  const rows = await query<{
    customer_key: string;
    customer_name: string;
    orders: string;
    purchase_value: string;
    paid: string;
    refunds: string;
  }>(
    `select coalesce(o.customer_id::text, 'pos:' || coalesce(nullif(o.pos_customer_name,''), 'Walk-in')) as customer_key,
            coalesce(nullif(o.pos_customer_name,''), c.full_name, 'Walk-in') as customer_name,
            count(distinct o.id)::text as orders,
            coalesce(sum(o.total_amount),0)::text as purchase_value,
            coalesce(sum((
              select coalesce(sum(p.amount),0) from payments p where p.order_id = o.id and p.status = 'paid'
            )),0)::text as paid,
            coalesce((
              select sum(r.refund_amount)
              from order_returns r
              join orders o2 on o2.id = r.order_id
              where r.status = 'refunded'
                and r.created_at::date between $1::date and $2::date
                and coalesce(o2.customer_id::text, 'pos:' || coalesce(nullif(o2.pos_customer_name,''), 'Walk-in'))
                    = coalesce(o.customer_id::text, 'pos:' || coalesce(nullif(o.pos_customer_name,''), 'Walk-in'))
            ),0)::text as refunds
     from orders o
     left join customers c on c.id = o.customer_id
     where ${where.join(" and ")}
     group by coalesce(o.customer_id::text, 'pos:' || coalesce(nullif(o.pos_customer_name,''), 'Walk-in')),
              coalesce(nullif(o.pos_customer_name,''), c.full_name, 'Walk-in')
     order by sum(o.total_amount) desc
     limit 1000`,
    params
  );

  const mapped = rows.map((r) => {
    const purchase = Number(r.purchase_value);
    const paid = Number(r.paid);
    return {
      customer: r.customer_name,
      orders: Number(r.orders),
      total_purchase_value: round2(purchase),
      total_paid: round2(paid),
      outstanding: round2(Math.max(0, purchase - paid)),
      returns_refunds: round2(Number(r.refunds))
    };
  });

  return paginateResult(
    "customers",
    "Customer report",
    range,
    [
      { key: "customer", label: "Customer" },
      { key: "orders", label: "Orders", format: "number" },
      { key: "total_purchase_value", label: "Total purchase", format: "money" },
      { key: "total_paid", label: "Total paid", format: "money" },
      { key: "outstanding", label: "Outstanding", format: "money" },
      { key: "returns_refunds", label: "Returns / refunds", format: "money" }
    ],
    mapped,
    {
      customers: mapped.length,
      total_purchase_value: round2(mapped.reduce((s, r) => s + r.total_purchase_value, 0)),
      total_paid: round2(mapped.reduce((s, r) => s + r.total_paid, 0)),
      outstanding: round2(mapped.reduce((s, r) => s + r.outstanding, 0))
    },
    page,
    pageSize
  );
}

/** 8. Supplier report */
export async function buildSupplierReport(filters: ReportFilters = {}): Promise<ReportResult> {
  await ensureFinanceSchema();
  const range = defaultRange(filters.from, filters.to);
  const { page, pageSize } = clampPage(filters.page, filters.pageSize);
  const params: unknown[] = [range.from, range.to];
  const where = [
    `direction = 'out'`,
    `category = 'purchase'`,
    `entry_date between $1::date and $2::date`
  ];
  if (filters.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    where.push(`coalesce(counterparty_name,'') ilike $${params.length}`);
  }

  const rows = await query<{
    supplier: string;
    purchases: string;
    purchase_value: string;
    paid: string;
    outstanding: string;
  }>(
    `select coalesce(nullif(counterparty_name,''), 'Supplier') as supplier,
            count(*)::text as purchases,
            coalesce(sum(amount),0)::text as purchase_value,
            coalesce(sum(amount) filter (where status = 'cleared'),0)::text as paid,
            coalesce(sum(amount) filter (where status = 'pending'),0)::text as outstanding
     from finance_payment_entries
     where ${where.join(" and ")}
     group by coalesce(nullif(counterparty_name,''), 'Supplier')
     order by sum(amount) desc`,
    params
  );

  const mapped = rows.map((r) => ({
    supplier: r.supplier,
    purchases: Number(r.purchases),
    purchase_value: Number(r.purchase_value),
    paid_amount: Number(r.paid),
    outstanding_amount: Number(r.outstanding)
  }));

  return paginateResult(
    "suppliers",
    "Supplier report",
    range,
    [
      { key: "supplier", label: "Supplier" },
      { key: "purchases", label: "Purchases", format: "number" },
      { key: "purchase_value", label: "Purchase value", format: "money" },
      { key: "paid_amount", label: "Paid", format: "money" },
      { key: "outstanding_amount", label: "Outstanding", format: "money" }
    ],
    mapped,
    {
      suppliers: mapped.length,
      purchase_value: round2(mapped.reduce((s, r) => s + r.purchase_value, 0)),
      paid_amount: round2(mapped.reduce((s, r) => s + r.paid_amount, 0)),
      outstanding_amount: round2(mapped.reduce((s, r) => s + r.outstanding_amount, 0))
    },
    page,
    pageSize
  );
}

/** 9. Inventory report — stock × selling price (existing valuation approach). */
export async function buildInventoryReport(filters: ReportFilters = {}): Promise<ReportResult> {
  const { page, pageSize } = clampPage(filters.page, filters.pageSize);
  const params: unknown[] = [];
  const where = [`1=1`];
  if (filters.q?.trim() || filters.product?.trim()) {
    params.push(`%${(filters.q || filters.product || "").trim()}%`);
    where.push(
      `(p.name ilike $${params.length} or coalesce(pv.sku,'') ilike $${params.length} or coalesce(pv.barcode,'') ilike $${params.length})`
    );
  }
  if (filters.category?.trim()) {
    params.push(`%${filters.category.trim()}%`);
    where.push(`coalesce(c.name,'') ilike $${params.length}`);
  }
  if (filters.stock_status === "low") {
    where.push(`pv.stock_quantity > 0 and pv.stock_quantity <= ${LOW_STOCK}`);
  } else if (filters.stock_status === "out") {
    where.push(`pv.stock_quantity <= 0`);
  } else if (filters.stock_status === "in") {
    where.push(`pv.stock_quantity > ${LOW_STOCK}`);
  }

  const rows = await query<{
    product_name: string;
    sku: string | null;
    category_name: string | null;
    stock_quantity: number;
    price: string;
  }>(
    `select p.name as product_name, pv.sku, c.name as category_name,
            pv.stock_quantity, coalesce(pv.price, p.price, 0)::text as price
     from product_variants pv
     join products p on p.id = pv.product_id
     left join categories c on c.id = p.category_id
     where ${where.join(" and ")}
     order by p.name asc, pv.sku asc
     limit 2000`,
    params
  );

  const mapped = rows.map((r) => {
    const qty = Number(r.stock_quantity || 0);
    const price = Number(r.price || 0);
    return {
      product: r.product_name,
      sku: r.sku || "—",
      category: r.category_name || "—",
      current_stock: qty,
      stock_value: round2(qty * price),
      low_stock: qty > 0 && qty <= LOW_STOCK ? "Yes" : "No",
      out_of_stock: qty <= 0 ? "Yes" : "No"
    };
  });

  return paginateResult(
    "inventory",
    "Inventory report",
    { from: null, to: null },
    [
      { key: "product", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Category" },
      { key: "current_stock", label: "Current stock", format: "number" },
      { key: "stock_value", label: "Stock value", format: "money" },
      { key: "low_stock", label: "Low stock" },
      { key: "out_of_stock", label: "Out of stock" }
    ],
    mapped,
    {
      skus: mapped.length,
      current_stock: mapped.reduce((s, r) => s + r.current_stock, 0),
      stock_value: round2(mapped.reduce((s, r) => s + r.stock_value, 0)),
      low_stock: mapped.filter((r) => r.low_stock === "Yes").length,
      out_of_stock: mapped.filter((r) => r.out_of_stock === "Yes").length
    },
    page,
    pageSize,
    {
      notes: [
        `Stock value = current stock × selling price (same threshold as Inventory: low ≤ ${LOW_STOCK}). Cost price is not stored as a queryable column.`
      ],
      links: [{ label: "Inventory", href: "/admin/inventory" }]
    }
  );
}

/** 10. Returns / refunds */
export async function buildReturnsReport(filters: ReportFilters = {}): Promise<ReportResult> {
  const range = defaultRange(filters.from, filters.to);
  const { page, pageSize } = clampPage(filters.page, filters.pageSize);
  const params: unknown[] = [range.from, range.to];
  const where = [`r.created_at::date between $1::date and $2::date`];
  if (filters.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    where.push(
      `(o.order_number ilike $${params.length} or coalesce(c.full_name,'') ilike $${params.length} or coalesce(o.pos_customer_name,'') ilike $${params.length})`
    );
  }

  const rows = await query<{
    created_at: string;
    order_number: string;
    customer_name: string | null;
    product_name: string | null;
    quantity: string;
    return_amount: string;
    refund_amount: string;
    reason: string | null;
    status: string;
  }>(
    `select r.created_at, o.order_number, coalesce(nullif(o.pos_customer_name,''), c.full_name, '—') as customer_name,
            coalesce(pr.name, oi.product_name, 'Item') as product_name,
            coalesce(ri.quantity, 0)::text as quantity,
            coalesce(
              case when oi.quantity > 0 then (ri.quantity::numeric / oi.quantity) * oi.line_total else 0 end,
              0
            )::text as return_amount,
            coalesce(r.refund_amount, 0)::text as refund_amount,
            coalesce(ri.reason, r.reason, '—') as reason,
            r.status
     from order_returns r
     join orders o on o.id = r.order_id
     left join customers c on c.id = o.customer_id
     left join return_items ri on ri.return_id = r.id
     left join order_items oi on oi.id = ri.order_item_id
     left join products pr on pr.id = oi.product_id
     where ${where.join(" and ")}
     order by r.created_at desc
     limit 2000`,
    params
  ).catch(async () => {
    // Fallback without line items
    return query<{
      created_at: string;
      order_number: string;
      customer_name: string | null;
      product_name: string | null;
      quantity: string;
      return_amount: string;
      refund_amount: string;
      reason: string | null;
      status: string;
    }>(
      `select r.created_at, o.order_number, coalesce(nullif(o.pos_customer_name,''), c.full_name, '—') as customer_name,
              '—' as product_name, '0' as quantity, coalesce(r.refund_amount,0)::text as return_amount,
              coalesce(r.refund_amount,0)::text as refund_amount, coalesce(r.reason,'—') as reason, r.status
       from order_returns r
       join orders o on o.id = r.order_id
       left join customers c on c.id = o.customer_id
       where ${where.join(" and ")}
       order by r.created_at desc
       limit 2000`,
      params
    );
  });

  const mapped = rows.map((r) => ({
    date: r.created_at,
    order_invoice: r.order_number,
    customer: r.customer_name,
    product: r.product_name || "—",
    return_quantity: Number(r.quantity),
    return_amount: round2(Number(r.return_amount)),
    refund_amount: round2(Number(r.refund_amount)),
    reason: r.reason || "—",
    status: r.status
  }));

  return paginateResult(
    "returns",
    "Returns / refunds report",
    range,
    [
      { key: "date", label: "Date", format: "date" },
      { key: "order_invoice", label: "Order / invoice" },
      { key: "customer", label: "Customer" },
      { key: "product", label: "Product" },
      { key: "return_quantity", label: "Return qty", format: "number" },
      { key: "return_amount", label: "Return amount", format: "money" },
      { key: "refund_amount", label: "Refund amount", format: "money" },
      { key: "reason", label: "Reason" },
      { key: "status", label: "Status" }
    ],
    mapped,
    {
      lines: mapped.length,
      return_amount: round2(mapped.reduce((s, r) => s + r.return_amount, 0)),
      refund_amount: round2(
        mapped
          .filter((r) => r.status === "refunded")
          .reduce((s, r) => s + r.refund_amount, 0)
      )
    },
    page,
    pageSize,
    { links: [{ label: "Returns", href: "/admin/returns" }] }
  );
}

/** 12. Profit — reuse Finance P&L */
export async function buildProfitReport(filters: ReportFilters = {}): Promise<ReportResult> {
  const range = defaultRange(filters.from, filters.to);
  const pnl = await buildProfitAndLoss({ from: range.from, to: range.to });

  // Discounts & returns from orders (Finance P&L is cashbook-based)
  const orderStats = await queryOne<{
    sales: string;
    discounts: string;
    returns: string;
  }>(
    `select
       coalesce(sum(total_amount) filter (where payment_status = 'paid'),0)::text as sales,
       coalesce(sum(discount_amount) filter (where payment_status = 'paid'),0)::text as discounts,
       coalesce((
         select sum(refund_amount) from order_returns r
         where r.status = 'refunded'
           and coalesce(r.updated_at, r.created_at)::date between $1::date and $2::date
       ),0)::text as returns
     from orders
     where created_at::date between $1::date and $2::date
       and coalesce(status,'') not in ('cancelled')`,
    [range.from, range.to]
  );

  const rows = [
    { metric: "Sales (orders paid)", amount: Number(orderStats?.sales || 0) },
    { metric: "Discounts (orders)", amount: Number(orderStats?.discounts || 0) },
    { metric: "Returns / refunds", amount: Number(orderStats?.returns || 0) },
    { metric: "Sales (finance cashbook)", amount: pnl.revenue },
    { metric: "Cost / purchases (finance)", amount: pnl.cogs },
    { metric: "Expenses (finance)", amount: pnl.operating_expenses },
    { metric: "Gross profit (finance)", amount: pnl.gross_profit },
    { metric: "Net profit (finance)", amount: pnl.net_profit }
  ];

  return {
    type: "profit",
    title: "Profit report",
    from: range.from,
    to: range.to,
    columns: [
      { key: "metric", label: "Metric" },
      { key: "amount", label: "Amount", format: "money" }
    ],
    rows,
    summary: {
      sales: Number(orderStats?.sales || 0),
      discounts: Number(orderStats?.discounts || 0),
      returns: Number(orderStats?.returns || 0),
      cost_purchase_value: pnl.cogs,
      expenses: pnl.operating_expenses,
      net_profit: pnl.net_profit
    },
    pagination: { page: 1, pageSize: 50, total: rows.length, total_pages: 1 },
    notes: [
      "Net profit uses the existing Finance P&L calculation (cashbook). Order sales/discounts/returns are shown for cross-check."
    ],
    links: [{ label: "Open full Profit & Loss", href: "/admin/finance/pnl" }]
  };
}

/** 13. Customer outstanding — Finance AR */
export async function buildCustomerOutstandingReport(
  filters: ReportFilters = {}
): Promise<ReportResult> {
  const { page, pageSize } = clampPage(filters.page, filters.pageSize);
  const rows = await listReceivables({
    from: filters.from,
    to: filters.to,
    q: filters.q || filters.customer
  });
  const mapped = rows.map((r) => ({
    customer: r.customer_name,
    invoice_order: r.order_number,
    invoice_amount: r.invoice_amount,
    paid_amount: r.paid_amount,
    outstanding_amount: r.outstanding_amount,
    due_status: r.status_label,
    days_overdue: r.days_overdue,
    ageing: r.ageing
  }));
  return paginateResult(
    "customer_outstanding",
    "Customer outstanding report",
    { from: filters.from || null, to: filters.to || null },
    [
      { key: "customer", label: "Customer" },
      { key: "invoice_order", label: "Invoice / order" },
      { key: "invoice_amount", label: "Invoice amount", format: "money" },
      { key: "paid_amount", label: "Paid", format: "money" },
      { key: "outstanding_amount", label: "Outstanding", format: "money" },
      { key: "due_status", label: "Due / overdue" },
      { key: "days_overdue", label: "Days overdue", format: "number" }
    ],
    mapped,
    {
      bills: mapped.length,
      outstanding_amount: round2(mapped.reduce((s, r) => s + r.outstanding_amount, 0))
    },
    page,
    pageSize,
    { links: [{ label: "Finance → Receivables", href: "/admin/finance/receivables" }] }
  );
}

/** 14. Supplier outstanding — Finance AP */
export async function buildSupplierOutstandingReport(
  filters: ReportFilters = {}
): Promise<ReportResult> {
  const { page, pageSize } = clampPage(filters.page, filters.pageSize);
  const rows = await listPayables({
    from: filters.from,
    to: filters.to,
    q: filters.q
  });
  const mapped = rows.map((r) => ({
    supplier: r.supplier_name,
    purchase_invoice: r.reference_no || r.entry_no,
    purchase_amount: r.invoice_amount,
    paid_amount: r.paid_amount,
    outstanding_amount: r.outstanding_amount,
    due_status: r.status_label,
    days_overdue: r.days_overdue,
    ageing: r.ageing
  }));
  return paginateResult(
    "supplier_outstanding",
    "Supplier outstanding report",
    { from: filters.from || null, to: filters.to || null },
    [
      { key: "supplier", label: "Supplier" },
      { key: "purchase_invoice", label: "Purchase invoice" },
      { key: "purchase_amount", label: "Purchase amount", format: "money" },
      { key: "paid_amount", label: "Paid", format: "money" },
      { key: "outstanding_amount", label: "Outstanding", format: "money" },
      { key: "due_status", label: "Due / overdue" },
      { key: "days_overdue", label: "Days overdue", format: "number" }
    ],
    mapped,
    {
      bills: mapped.length,
      outstanding_amount: round2(mapped.reduce((s, r) => s + r.outstanding_amount, 0))
    },
    page,
    pageSize,
    { links: [{ label: "Finance → Payables", href: "/admin/finance/payables" }] }
  );
}

export async function runReport(type: string, filters: ReportFilters = {}): Promise<ReportResult> {
  switch (type) {
    case "sales":
      return buildSalesReport(filters);
    case "purchases":
      return buildPurchaseReport(filters);
    case "product_sales":
      return buildProductSalesReport(filters);
    case "category_sales":
      return buildCategorySalesReport(filters);
    case "payments":
      return buildCollectionsReport(filters);
    case "expenses":
      return buildExpenseReportDetailed(filters);
    case "customers":
      return buildCustomerReport(filters);
    case "suppliers":
      return buildSupplierReport(filters);
    case "inventory":
      return buildInventoryReport(filters);
    case "returns":
      return buildReturnsReport(filters);
    case "orders":
      return buildOrderReport(filters);
    case "profit":
      return buildProfitReport(filters);
    case "customer_outstanding":
      return buildCustomerOutstandingReport(filters);
    case "supplier_outstanding":
      return buildSupplierOutstandingReport(filters);
    default:
      throw new Error(
        "Unknown report type. Use sales|purchases|product_sales|category_sales|payments|expenses|customers|suppliers|inventory|returns|orders|profit|customer_outstanding|supplier_outstanding"
      );
  }
}

export function rowsToCsv(
  columns: ReportColumn[],
  rows: Array<Record<string, unknown>>
): string {
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => escape(row[c.key])).join(",")).join("\n");
  return `${header}\n${body}`;
}
