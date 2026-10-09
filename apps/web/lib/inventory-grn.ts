import type { QueryResultRow } from "pg";
import { query, queryOne, withTransaction } from "./db/pool";
import {
  createProductUnits,
  ensureProductUnitsSchema,
  syncSellableStock
} from "./product-units";
import { skipEnsureIfRelationExists } from "./schema-bootstrap";
import type { GrnPrintDetail } from "./print-grn";
import { ensureCompanySettingsSchema } from "./company-settings";
import { ensureSuppliersSchema, getSupplierById, supplierLabel } from "./suppliers";
import { ensureColourName } from "./colours";
import { nextDocumentNumber } from "./document-numbers";

export type { GrnPrintDetail };

export const GRN_STATUSES = ["pending_approval", "approved", "cancelled"] as const;
export type GrnStatus = (typeof GRN_STATUSES)[number];

export type GrnColorBatch = {
  color: string;
  quantity: number;
};

export type GrnLineInput = {
  productVariantId: string;
  quantity: number;
  purchasePrice: number;
  /** Colour-wise counts for multi-colour products. */
  colorBreakdown?: GrnColorBatch[];
};

function computeGrnLineTotal(quantity: number, purchasePrice: number) {
  return Math.round(quantity * purchasePrice * 100) / 100;
}

export type ParsedGrnPayload = {
  supplierId: string;
  supplierName: string;
  supplierMeta: string;
  billNo: string;
  invoiceAmount: number;
  invoiceDate: string | null;
  documentPath: string | null;
  /** Whole-GRN discount ₹ */
  discountAmount: number;
  /** Whole-GRN tax ₹ */
  taxAmount: number;
  extraNote: string;
  lines: GrnLineInput[];
  /** Sum of line purchase amounts (before GRN discount/tax). */
  linesTotal: number;
  /** linesTotal − discount + tax */
  grandTotal: number;
  note: string | null;
};

type Db = {
  query: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>;
  queryOne: <R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<R | null>;
};

let schemaReady = false;

export async function ensureInventoryGrnSchema() {
  if (schemaReady) return;

  const grnsReady = await skipEnsureIfRelationExists("public.inventory_grns");

  // FK target — create suppliers first when GRN tables are missing.
  await ensureSuppliersSchema();

  if (!grnsReady) {
    await query(`
      create table if not exists public.inventory_grns (
        id uuid primary key default gen_random_uuid(),
        grn_number text not null unique,
        status text not null default 'pending_approval'
          check (status in ('pending_approval', 'approved', 'cancelled')),
        supplier_id uuid references public.suppliers(id),
        bill_no text,
        invoice_amount numeric(12,2),
        lines_total numeric(12,2) not null default 0,
        note text,
        created_by uuid,
        approved_by uuid,
        approved_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);

    await query(`
      create table if not exists public.inventory_grn_lines (
        id uuid primary key default gen_random_uuid(),
        grn_id uuid not null references public.inventory_grns(id) on delete cascade,
        product_variant_id uuid not null references public.product_variants(id),
        quantity integer not null check (quantity > 0),
        purchase_price numeric(12,2) not null check (purchase_price >= 0),
        line_total numeric(12,2) not null check (line_total >= 0),
        sort_order integer not null default 0
      )
    `);
  }

  // Always keep columns in sync — table may exist from an older patch.
  await query(`
    alter table public.inventory_grns
      add column if not exists shop_id uuid references public.shops(id)
  `);
  await query(`
    create index if not exists inventory_grns_shop_id_idx
      on public.inventory_grns (shop_id)
      where shop_id is not null
  `);
  await query(`
    create index if not exists inventory_grns_status_created_idx
      on public.inventory_grns (status, created_at desc)
  `);

  await query(`
    create unique index if not exists inventory_grns_supplier_bill_active_uidx
      on public.inventory_grns (supplier_id, lower(btrim(bill_no)))
      where bill_no is not null
        and btrim(bill_no) <> ''
        and status in ('pending_approval', 'approved')
  `);

  await query(`
    alter table public.inventory_grns
      add column if not exists invoice_date date,
      add column if not exists document_path text,
      add column if not exists discount_amount numeric(12,2) not null default 0,
      add column if not exists tax_amount numeric(12,2) not null default 0
  `);

  await query(`
    alter table public.inventory_grn_lines
      add column if not exists color_breakdown jsonb
  `);

  schemaReady = true;
}

export async function parseAndValidateGrnBody(body: {
  supplier?: string;
  supplierId?: string;
  billNo?: string;
  note?: string;
  invoiceAmount?: number;
  invoiceDate?: string | null;
  documentPath?: string | null;
  discountAmount?: number;
  taxAmount?: number;
  lines?: Array<{
    productVariantId?: string;
    quantity?: number;
    purchasePrice?: number;
    colorBreakdown?: Array<{ color?: string; quantity?: number }>;
  }>;
}): Promise<{ ok: true; data: ParsedGrnPayload } | { ok: false; error: string }> {
  await ensureProductUnitsSchema();
  const lines = (body.lines || [])
    .map((line) => {
      const colorBreakdown = Array.isArray(line.colorBreakdown)
        ? line.colorBreakdown
            .map((s) => ({
              color: String(s.color || "").trim(),
              quantity: Math.trunc(Number(s.quantity) || 0)
            }))
            .filter((s) => s.color && s.quantity > 0)
        : undefined;
      return {
        productVariantId: String(line.productVariantId || "").trim(),
        quantity: Number(line.quantity),
        purchasePrice:
          line.purchasePrice == null || line.purchasePrice === ("" as unknown)
            ? NaN
            : Number(line.purchasePrice),
        colorBreakdown
      };
    })
    .filter((line) => line.productVariantId && Number.isFinite(line.quantity) && line.quantity > 0);

  if (!lines.length) {
    return { ok: false, error: "Add at least one line with variant and quantity > 0" };
  }

  for (const line of lines) {
    if (!Number.isFinite(line.purchasePrice) || line.purchasePrice < 0) {
      return { ok: false, error: "Enter purchase price (₹) for every line" };
    }
  }

  // Validate multi-colour breakdown against product flags.
  for (const line of lines) {
    const product = await queryOne<{
      is_multicolour: boolean | null;
      color: string | null;
      name: string;
    }>(
      `select p.is_multicolour, p.color, p.name
       from product_variants v
       join products p on p.id = v.product_id
       where v.id = $1`,
      [line.productVariantId]
    );
    if (!product) {
      return { ok: false, error: `Variant not found for a GRN line` };
    }
    if (product.is_multicolour) {
      if (!line.colorBreakdown?.length) {
        return {
          ok: false,
          error: `${product.name} is multi-colour — enter colour-wise quantities on that line`
        };
      }
      const splitQty = line.colorBreakdown.reduce((sum, s) => sum + s.quantity, 0);
      if (splitQty !== Math.trunc(line.quantity)) {
        return {
          ok: false,
          error: `${product.name}: colour quantities (${splitQty}) must equal line qty (${Math.trunc(line.quantity)})`
        };
      }
      for (const split of line.colorBreakdown) {
        await ensureColourName(split.color);
      }
    } else if (line.colorBreakdown?.length) {
      // Ignore accidental splits on single-colour products
      line.colorBreakdown = undefined;
    }
  }

  const supplierId = String(body.supplierId || "").trim();
  if (!supplierId) {
    return { ok: false, error: "Select an active supplier from Supplier Master" };
  }

  await ensureSuppliersSchema();
  const supplier = await getSupplierById(supplierId);
  if (!supplier || !supplier.is_active) {
    return { ok: false, error: "Select an active supplier from Supplier Master" };
  }

  const supplierName = supplierLabel(supplier);
  const supplierMeta = [
    supplier.gstin ? `GSTIN ${supplier.gstin}` : "",
    supplier.pan ? `PAN ${supplier.pan}` : "",
    supplier.state ? `State ${supplier.state}` : "",
    supplier.state_code ? `State code ${supplier.state_code}` : ""
  ]
    .filter(Boolean)
    .join(" · ");

  const billNo = (body.billNo || "").trim();
  const extraNote = (body.note || "").trim();
  const invoiceAmountRaw = body.invoiceAmount;
  const invoiceAmount =
    invoiceAmountRaw == null || invoiceAmountRaw === ("" as unknown)
      ? NaN
      : Number(invoiceAmountRaw);
  if (!Number.isFinite(invoiceAmount) || invoiceAmount < 0) {
    return { ok: false, error: "Invoice amount must be a valid number" };
  }

  const invoiceDateRaw = String(body.invoiceDate || "").trim();
  let invoiceDate: string | null = null;
  if (invoiceDateRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDateRaw)) {
      return { ok: false, error: "Invoice date must be YYYY-MM-DD" };
    }
    const parsed = new Date(`${invoiceDateRaw}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Invoice date is invalid" };
    }
    invoiceDate = invoiceDateRaw;
  }

  const documentPathRaw = String(body.documentPath || "").trim();
  const documentPath =
    documentPathRaw && documentPathRaw.startsWith("/uploads/")
      ? documentPathRaw.slice(0, 500)
      : null;

  const mappedLines = lines.map((l) => ({
    productVariantId: l.productVariantId,
    quantity: Math.trunc(Math.abs(l.quantity)),
    purchasePrice: l.purchasePrice,
    colorBreakdown: l.colorBreakdown
  }));

  const discountRaw = body.discountAmount;
  const taxRaw = body.taxAmount;
  const discountAmount =
    discountRaw == null || discountRaw === ("" as unknown) ? 0 : Number(discountRaw);
  const taxAmount = taxRaw == null || taxRaw === ("" as unknown) ? 0 : Number(taxRaw);
  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    return { ok: false, error: "Discount must be zero or a positive amount (₹)" };
  }
  if (!Number.isFinite(taxAmount) || taxAmount < 0) {
    return { ok: false, error: "Tax must be zero or a positive amount (₹)" };
  }

  const linesTotal = mappedLines.reduce(
    (sum, line) => sum + computeGrnLineTotal(line.quantity, line.purchasePrice),
    0
  );
  if (discountAmount > linesTotal + 0.001) {
    return { ok: false, error: "Discount cannot exceed lines total" };
  }
  const grandTotal = Math.round((linesTotal - discountAmount + taxAmount) * 100) / 100;

  const noteParts = [
    supplierName ? `Supplier: ${supplierName}` : "",
    supplierMeta,
    billNo ? `Bill: ${billNo}` : "",
    invoiceDate ? `Invoice date: ${invoiceDate}` : "",
    `Invoice amt: ₹${invoiceAmount.toFixed(2)}`,
    discountAmount > 0 ? `Discount: ₹${discountAmount.toFixed(2)}` : "",
    taxAmount > 0 ? `Tax: ₹${taxAmount.toFixed(2)}` : "",
    `Lines total: ₹${linesTotal.toFixed(2)}`,
    `Grand total: ₹${grandTotal.toFixed(2)}`,
    extraNote
  ].filter(Boolean);

  return {
    ok: true,
    data: {
      supplierId,
      supplierName,
      supplierMeta,
      billNo,
      invoiceAmount,
      invoiceDate,
      documentPath,
      discountAmount: Math.round(discountAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      extraNote,
      lines: mappedLines,
      linesTotal,
      grandTotal,
      note: noteParts.join(" · ") || null
    }
  };
}

/** Apply stock for an already-locked pending GRN. Idempotent guard: caller must lock pending row. */
export async function applyApprovedGrnStock(
  db: Db,
  input: {
    grnId: string;
    userId: string;
    payload: ParsedGrnPayload;
    shopId: string;
  }
) {
  await ensureProductUnitsSchema();
  await ensureSuppliersSchema();

  const movements: Array<Record<string, unknown>> = [];
  const updated: Array<{
    productVariantId: string;
    stockQuantity: number;
    unitsCreated: number;
    purchasePrice: number;
    lineTotal: number;
  }> = [];
  const createdItems: Array<Record<string, unknown>> = [];

  for (const line of input.payload.lines) {
    const variant = await db.queryOne<{
      id: string;
      product_id: string;
      sku: string;
    }>(`select id, product_id, sku from product_variants where id = $1 for update`, [
      line.productVariantId
    ]);
    if (!variant) {
      throw new Error(`Variant not found: ${line.productVariantId}`);
    }

    const tagged = await db.queryOne<{
      tag: string | null;
      sku: string | null;
      color: string | null;
      is_multicolour: boolean | null;
    }>(`select tag, sku, color, is_multicolour from products where id = $1`, [variant.product_id]);

    const qty = line.quantity;
    const colorBatches =
      tagged?.is_multicolour && line.colorBreakdown?.length
        ? line.colorBreakdown.map((s) => ({ color: s.color, count: s.quantity }))
        : undefined;
    const items = await createProductUnits(db, {
      productId: variant.product_id,
      variantId: variant.id,
      tag: tagged?.tag || tagged?.sku || variant.sku,
      sku: tagged?.sku || variant.sku,
      count: qty,
      shopId: input.shopId,
      color: tagged?.is_multicolour ? null : tagged?.color || null,
      colorBatches
    });
    createdItems.push(...(items as unknown as Record<string, unknown>[]));

    await syncSellableStock(db, variant.id, input.shopId);

    const stockRow = await db.queryOne<{ stock_quantity: number }>(
      `select coalesce(stock_quantity, 0)::int as stock_quantity
       from shop_variant_stock where shop_id = $1 and variant_id = $2`,
      [input.shopId, variant.id]
    );

    await db.query(
      `update products p
       set stock_quantity = coalesce((
         select sum(pv.stock_quantity)::int from product_variants pv where pv.product_id = p.id
       ), 0),
       updated_at = now()
       where p.id = $1`,
      [variant.product_id]
    );

    const lineTotal = computeGrnLineTotal(line.quantity, line.purchasePrice);
    const lineNote = [
      input.payload.note,
      `Purchase @ ₹${Number(line.purchasePrice).toFixed(2)}`,
      `Line total ₹${lineTotal.toFixed(2)}`,
      `GRN ${input.grnId.slice(0, 8)}`
    ]
      .filter(Boolean)
      .join(" · ");

    const movement = await db.queryOne(
      `insert into inventory_movements
         (product_variant_id, type, quantity, reference_type, reference_id, note, created_by, supplier_id, shop_id)
       values ($1, 'purchase', $2, 'grn', $3, $4, $5, $6, $7)
       returning *`,
      [
        line.productVariantId,
        qty,
        input.grnId,
        lineNote,
        input.userId,
        input.payload.supplierId,
        input.shopId
      ]
    );

    if (movement) movements.push(movement as Record<string, unknown>);
    updated.push({
      productVariantId: line.productVariantId,
      stockQuantity: Number(stockRow?.stock_quantity || 0),
      unitsCreated: items.length,
      purchasePrice: line.purchasePrice,
      lineTotal
    });
  }

  return { movements, updated, createdItems };
}

export async function createPendingGrn(input: {
  userId: string;
  payload: ParsedGrnPayload;
  shopId?: string | null;
}): Promise<{ id: string; grn_number: string; status: GrnStatus }> {
  await ensureInventoryGrnSchema();

  if (input.payload.billNo) {
    const clash = await queryOne<{ id: string; grn_number: string; status: string }>(
      `select id, grn_number, status from inventory_grns
       where supplier_id = $1
         and lower(btrim(bill_no)) = lower(btrim($2))
         and status in ('pending_approval', 'approved')
       limit 1`,
      [input.payload.supplierId, input.payload.billNo]
    );
    if (clash) {
      throw new Error(
        `A GRN already exists for this supplier bill (${clash.grn_number}, ${clash.status}).`
      );
    }
  }

  return withTransaction(async (db) => {
    const variantIds = [...new Set(input.payload.lines.map((l) => l.productVariantId))];
    const found = await db.query<{ id: string }>(
      `select id from product_variants where id = any($1::uuid[])`,
      [variantIds]
    );
    if (found.length !== variantIds.length) {
      const ok = new Set(found.map((r) => r.id));
      const missing = variantIds.find((id) => !ok.has(id));
      throw new Error(`Variant not found: ${missing}`);
    }

    const grnNumber = await nextDocumentNumber("grn", db);
    const grn = await db.queryOne<{ id: string; grn_number: string; status: GrnStatus }>(
      `insert into inventory_grns (
         grn_number, status, supplier_id, bill_no, invoice_amount, invoice_date, document_path,
         discount_amount, tax_amount, lines_total, note, created_by, shop_id
       ) values ($1, 'pending_approval', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       returning id, grn_number, status`,
      [
        grnNumber,
        input.payload.supplierId,
        input.payload.billNo || null,
        input.payload.invoiceAmount,
        input.payload.invoiceDate,
        input.payload.documentPath,
        input.payload.discountAmount,
        input.payload.taxAmount,
        input.payload.linesTotal,
        input.payload.note,
        input.userId,
        input.shopId || null
      ]
    );
    if (!grn) throw new Error("Could not create GRN");

    const valueSql: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    input.payload.lines.forEach((line, sort) => {
      const lineTotal = computeGrnLineTotal(line.quantity, line.purchasePrice);
      valueSql.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
      params.push(
        grn.id,
        line.productVariantId,
        line.quantity,
        line.purchasePrice,
        lineTotal,
        sort,
        line.colorBreakdown?.length ? JSON.stringify(line.colorBreakdown) : null
      );
    });

    await db.query(
      `insert into inventory_grn_lines (
         grn_id, product_variant_id, quantity, purchase_price, line_total, sort_order, color_breakdown
       ) values ${valueSql.join(", ")}`,
      params
    );

    return grn;
  });
}

export async function loadGrnPayload(
  grnId: string
): Promise<{
  grn: {
    id: string;
    grn_number: string;
    status: string;
    supplier_id: string | null;
    bill_no: string | null;
    invoice_amount: string | number | null;
    lines_total: string | number;
    note: string | null;
  };
  payload: ParsedGrnPayload;
} | null> {
  await ensureInventoryGrnSchema();
  const grn = await queryOne<{
    id: string;
    grn_number: string;
    status: string;
    supplier_id: string | null;
    bill_no: string | null;
    invoice_amount: string | number | null;
    invoice_date: string | null;
    document_path: string | null;
    discount_amount: string | number | null;
    tax_amount: string | number | null;
    lines_total: string | number;
    note: string | null;
  }>(`select * from inventory_grns where id = $1`, [grnId]);
  if (!grn) return null;

  const lines = await query<{
    product_variant_id: string;
    quantity: number;
    purchase_price: string | number;
    color_breakdown: GrnColorBatch[] | string | null;
  }>(
    `select product_variant_id, quantity, purchase_price, color_breakdown
     from inventory_grn_lines where grn_id = $1 order by sort_order asc`,
    [grnId]
  );

  let supplierName = "";
  let supplierMeta = "";
  if (grn.supplier_id) {
    const supplier = await getSupplierById(grn.supplier_id);
    if (supplier) {
      supplierName = supplierLabel(supplier);
      supplierMeta = [
        supplier.gstin ? `GSTIN ${supplier.gstin}` : "",
        supplier.pan ? `PAN ${supplier.pan}` : ""
      ]
        .filter(Boolean)
        .join(" · ");
    }
  }

  const mapped = lines.map((l) => {
    let colorBreakdown: GrnColorBatch[] | undefined;
    const raw = l.color_breakdown;
    if (Array.isArray(raw)) {
      colorBreakdown = raw
        .map((s) => ({
          color: String((s as GrnColorBatch).color || "").trim(),
          quantity: Math.trunc(Number((s as GrnColorBatch).quantity) || 0)
        }))
        .filter((s) => s.color && s.quantity > 0);
    } else if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw) as GrnColorBatch[];
        if (Array.isArray(parsed)) {
          colorBreakdown = parsed
            .map((s) => ({
              color: String(s.color || "").trim(),
              quantity: Math.trunc(Number(s.quantity) || 0)
            }))
            .filter((s) => s.color && s.quantity > 0);
        }
      } catch {
        colorBreakdown = undefined;
      }
    }
    return {
      productVariantId: l.product_variant_id,
      quantity: Number(l.quantity),
      purchasePrice: Number(l.purchase_price),
      colorBreakdown: colorBreakdown?.length ? colorBreakdown : undefined
    };
  });
  const linesTotal = Number(grn.lines_total || 0);
  const discountAmount = Number(grn.discount_amount || 0);
  const taxAmount = Number(grn.tax_amount || 0);
  const grandTotal = Math.round((linesTotal - discountAmount + taxAmount) * 100) / 100;

  return {
    grn,
    payload: {
      supplierId: grn.supplier_id || "",
      supplierName,
      supplierMeta,
      billNo: grn.bill_no || "",
      invoiceAmount: Number(grn.invoice_amount || 0),
      invoiceDate: grn.invoice_date || null,
      documentPath: grn.document_path || null,
      discountAmount,
      taxAmount,
      extraNote: "",
      lines: mapped,
      linesTotal,
      grandTotal,
      note: grn.note
    }
  };
}

/**
 * Approve one pending GRN and apply stock exactly once.
 * Returns structured result for bulk summaries.
 */
export async function approveGrnOnce(input: {
  grnId: string;
  userId: string;
  shopId?: string | null;
}): Promise<
  | { ok: true; grn_number: string; units: number; movements: number }
  | { ok: false; error: string; grn_number?: string }
> {
  await ensureInventoryGrnSchema();

  try {
    const result = await withTransaction(async (db) => {
      const locked = await db.queryOne<{
        id: string;
        grn_number: string;
        status: string;
        shop_id: string | null;
      }>(
        `select id, grn_number, status, shop_id from inventory_grns where id = $1 for update`,
        [input.grnId]
      );
      if (!locked) return { kind: "missing" as const };
      if (locked.status === "approved") {
        return { kind: "already" as const, grn_number: locked.grn_number };
      }
      if (locked.status !== "pending_approval") {
        return {
          kind: "invalid" as const,
          grn_number: locked.grn_number,
          status: locked.status
        };
      }

      // Extra guard: no prior stock movements for this GRN
      const prior = await db.queryOne<{ c: string }>(
        `select count(*)::text as c from inventory_movements
         where reference_type = 'grn' and reference_id = $1`,
        [locked.id]
      );
      if (Number(prior?.c || 0) > 0) {
        await db.query(
          `update inventory_grns
           set status = 'approved', approved_by = $2, approved_at = now(), updated_at = now()
           where id = $1`,
          [locked.id, input.userId]
        );
        return { kind: "already" as const, grn_number: locked.grn_number };
      }

      const loaded = await loadGrnPayload(locked.id);
      if (!loaded || !loaded.payload.lines.length) {
        return { kind: "invalid" as const, grn_number: locked.grn_number, status: "empty" };
      }

      const shopId =
        input.shopId ||
        locked.shop_id ||
        (
          await db.queryOne<{ id: string }>(
            `select id from shops where is_default = true and is_active = true limit 1`
          )
        )?.id;
      if (!shopId) {
        return {
          kind: "invalid" as const,
          grn_number: locked.grn_number,
          status: "no_shop"
        };
      }

      if (!locked.shop_id) {
        await db.query(`update inventory_grns set shop_id = $2 where id = $1`, [
          locked.id,
          shopId
        ]);
      }

      const applied = await applyApprovedGrnStock(db, {
        grnId: locked.id,
        userId: input.userId,
        payload: loaded.payload,
        shopId
      });

      await db.query(
        `update inventory_grns
         set status = 'approved', approved_by = $2, approved_at = now(), updated_at = now()
         where id = $1`,
        [locked.id, input.userId]
      );

      return {
        kind: "ok" as const,
        grn_number: locked.grn_number,
        units: applied.createdItems.length,
        movements: applied.movements.length,
        applied
      };
    });

    if (result.kind === "missing") return { ok: false, error: "GRN not found" };
    if (result.kind === "already") {
      return { ok: false, error: "Already approved — stock was not applied again", grn_number: result.grn_number };
    }
    if (result.kind === "invalid") {
      return {
        ok: false,
        error: `Cannot approve GRN in status “${result.status}”`,
        grn_number: result.grn_number
      };
    }

    return {
      ok: true,
      grn_number: result.grn_number,
      units: result.units,
      movements: result.movements
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Approve failed"
    };
  }
}

export async function getGrnPrintDetail(grnId: string): Promise<GrnPrintDetail | null> {
  await ensureInventoryGrnSchema();
  await ensureCompanySettingsSchema();
  const grn = await queryOne<{
    id: string;
    grn_number: string;
    status: string;
    bill_no: string | null;
    invoice_amount: string | number | null;
    invoice_date: string | null;
    document_path: string | null;
    discount_amount: string | number | null;
    tax_amount: string | number | null;
    lines_total: string | number;
    note: string | null;
    created_at: string;
    approved_at: string | null;
    supplier_id: string | null;
    supplier_code: string | null;
    supplier_name: string | null;
    trade_name: string | null;
    gstin: string | null;
    pan: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    state_code: string | null;
  }>(
    `select g.id, g.grn_number, g.status, g.bill_no, g.invoice_amount, g.invoice_date,
            g.document_path, coalesce(g.discount_amount, 0) as discount_amount,
            coalesce(g.tax_amount, 0) as tax_amount, g.lines_total, g.note,
            g.created_at, g.approved_at, g.supplier_id,
            s.code as supplier_code, s.name as supplier_name, s.trade_name, s.gstin, s.pan,
            s.phone, s.address, s.city, s.state, s.state_code
     from inventory_grns g
     left join suppliers s on s.id = g.supplier_id
     where g.id = $1`,
    [grnId]
  );
  if (!grn) return null;

  const lines = await query<{
    product_name: string;
    sku: string | null;
    variant_name: string | null;
    quantity: number;
    purchase_price: string | number;
    line_total: string | number;
    color_breakdown: GrnColorBatch[] | string | null;
  }>(
    `select p.name as product_name, coalesce(p.sku, v.sku) as sku, v.name as variant_name,
            l.quantity, l.purchase_price, l.line_total, l.color_breakdown
     from inventory_grn_lines l
     join product_variants v on v.id = l.product_variant_id
     join products p on p.id = v.product_id
     where l.grn_id = $1
     order by l.sort_order asc`,
    [grnId]
  );

  const company = await queryOne<{
    company_legal_name: string | null;
    site_name: string | null;
    company_address: string | null;
    company_gstin: string | null;
    support_phone: string | null;
  }>(
    `select company_legal_name, site_name, company_address, company_gstin, support_phone
     from site_settings limit 1`
  );

  return {
    id: grn.id,
    grn_number: grn.grn_number,
    status: grn.status,
    bill_no: grn.bill_no,
    invoice_amount: Number(grn.invoice_amount || 0),
    invoice_date: grn.invoice_date,
    document_path: grn.document_path,
    discount_amount: Number(grn.discount_amount || 0),
    tax_amount: Number(grn.tax_amount || 0),
    lines_total: Number(grn.lines_total || 0),
    note: grn.note,
    created_at: grn.created_at,
    approved_at: grn.approved_at,
    supplier: {
      id: grn.supplier_id,
      code: grn.supplier_code,
      name: grn.supplier_name,
      trade_name: grn.trade_name,
      gstin: grn.gstin,
      pan: grn.pan,
      phone: grn.phone,
      address: grn.address,
      city: grn.city,
      state: grn.state,
      state_code: grn.state_code
    },
    company: {
      name: company?.company_legal_name || company?.site_name || "VASRITHA BOUTIQUE",
      address: company?.company_address || null,
      gstin: company?.company_gstin || null,
      phone: company?.support_phone || null
    },
    lines: lines.map((l) => {
      let color_breakdown: GrnColorBatch[] | null = null;
      const raw = l.color_breakdown;
      if (Array.isArray(raw)) {
        color_breakdown = raw
          .map((s) => ({
            color: String((s as GrnColorBatch).color || "").trim(),
            quantity: Math.trunc(Number((s as GrnColorBatch).quantity) || 0)
          }))
          .filter((s) => s.color && s.quantity > 0);
      } else if (typeof raw === "string" && raw.trim()) {
        try {
          const parsed = JSON.parse(raw) as GrnColorBatch[];
          if (Array.isArray(parsed)) {
            color_breakdown = parsed
              .map((s) => ({
                color: String(s.color || "").trim(),
                quantity: Math.trunc(Number(s.quantity) || 0)
              }))
              .filter((s) => s.color && s.quantity > 0);
          }
        } catch {
          color_breakdown = null;
        }
      }
      return {
        product_name: l.product_name,
        sku: l.sku,
        variant_name: l.variant_name,
        quantity: Number(l.quantity),
        purchase_price: Number(l.purchase_price),
        line_total: Number(l.line_total),
        color_breakdown: color_breakdown?.length ? color_breakdown : null
      };
    })
  };
}

export async function listGrns(filters: {
  status?: string | null;
  supplierId?: string | null;
  shopId?: string | null;
  limit?: number;
}) {
  await ensureInventoryGrnSchema();
  const status = filters.status?.trim() || null;
  const supplierId = filters.supplierId?.trim() || null;
  const shopId = filters.shopId?.trim() || null;
  const limit = Math.min(200, Math.max(1, filters.limit || 50));

  return query(
    `select g.id, g.grn_number, g.status, g.supplier_id, g.bill_no, g.invoice_amount,
            g.invoice_date, g.document_path, g.shop_id,
            g.lines_total, g.note, g.created_by, g.approved_by, g.approved_at, g.created_at,
            s.name as supplier_name, s.code as supplier_code,
            (select count(*)::int from inventory_grn_lines l where l.grn_id = g.id) as line_count
     from inventory_grns g
     left join suppliers s on s.id = g.supplier_id
     where ($1::text is null or g.status = $1)
       and ($2::uuid is null or g.supplier_id = $2)
       and ($3::uuid is null or g.shop_id = $3)
     order by g.created_at desc
     limit $4`,
    [status, supplierId, shopId, limit]
  );
}
