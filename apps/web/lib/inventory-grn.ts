import type { QueryResultRow } from "pg";
import { query, queryOne, withTransaction } from "./db/pool";
import {
  createProductUnits,
  ensureProductUnitsSchema,
  syncSellableStock
} from "./product-units";
import { skipRuntimeSchemaEnsure } from "./schema-bootstrap";
import { ensureSuppliersSchema, getSupplierById, supplierLabel } from "./suppliers";

export const GRN_STATUSES = ["pending_approval", "approved", "cancelled"] as const;
export type GrnStatus = (typeof GRN_STATUSES)[number];

export type GrnLineInput = {
  productVariantId: string;
  quantity: number;
  purchasePrice: number;
};

export type ParsedGrnPayload = {
  supplierId: string;
  supplierName: string;
  supplierMeta: string;
  billNo: string;
  invoiceAmount: number;
  extraNote: string;
  lines: GrnLineInput[];
  linesTotal: number;
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
  if (schemaReady || skipRuntimeSchemaEnsure()) {
    schemaReady = true;
    return;
  }

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

  schemaReady = true;
}

export async function parseAndValidateGrnBody(body: {
  supplier?: string;
  supplierId?: string;
  billNo?: string;
  note?: string;
  invoiceAmount?: number;
  lines?: Array<{ productVariantId?: string; quantity?: number; purchasePrice?: number }>;
}): Promise<{ ok: true; data: ParsedGrnPayload } | { ok: false; error: string }> {
  const lines = (body.lines || [])
    .map((line) => ({
      productVariantId: String(line.productVariantId || "").trim(),
      quantity: Number(line.quantity),
      purchasePrice:
        line.purchasePrice == null || line.purchasePrice === ("" as unknown)
          ? NaN
          : Number(line.purchasePrice)
    }))
    .filter((line) => line.productVariantId && Number.isFinite(line.quantity) && line.quantity > 0);

  if (!lines.length) {
    return { ok: false, error: "Add at least one line with variant and quantity > 0" };
  }

  for (const line of lines) {
    if (!Number.isFinite(line.purchasePrice) || line.purchasePrice < 0) {
      return { ok: false, error: "Enter purchase price (₹) for every line" };
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

  const linesTotal = lines.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.purchasePrice * 100) / 100,
    0
  );

  const noteParts = [
    supplierName ? `Supplier: ${supplierName}` : "",
    supplierMeta,
    billNo ? `Bill: ${billNo}` : "",
    `Invoice amt: ₹${invoiceAmount.toFixed(2)}`,
    `Lines total: ₹${linesTotal.toFixed(2)}`,
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
      extraNote,
      lines: lines.map((l) => ({
        productVariantId: l.productVariantId,
        quantity: Math.trunc(Math.abs(l.quantity)),
        purchasePrice: l.purchasePrice
      })),
      linesTotal,
      note: noteParts.join(" · ") || null
    }
  };
}

function nextGrnNumber() {
  return `GRN-${Date.now().toString().slice(-10)}`;
}

/** Apply stock for an already-locked pending GRN. Idempotent guard: caller must lock pending row. */
export async function applyApprovedGrnStock(
  db: Db,
  input: {
    grnId: string;
    userId: string;
    payload: ParsedGrnPayload;
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

    const tagged = await db.queryOne<{ tag: string | null; sku: string | null }>(
      `select tag, sku from products where id = $1`,
      [variant.product_id]
    );

    const qty = line.quantity;
    const items = await createProductUnits(db, {
      productId: variant.product_id,
      variantId: variant.id,
      tag: tagged?.tag || tagged?.sku || variant.sku,
      sku: tagged?.sku || variant.sku,
      count: qty
    });
    createdItems.push(...(items as unknown as Record<string, unknown>[]));

    await syncSellableStock(db, variant.id);

    const stockRow = await db.queryOne<{ stock_quantity: number }>(
      `select stock_quantity from product_variants where id = $1`,
      [variant.id]
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

    const lineTotal = Math.round(line.quantity * line.purchasePrice * 100) / 100;
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
         (product_variant_id, type, quantity, reference_type, reference_id, note, created_by, supplier_id)
       values ($1, 'purchase', $2, 'grn', $3, $4, $5, $6)
       returning *`,
      [
        line.productVariantId,
        qty,
        input.grnId,
        lineNote,
        input.userId,
        input.payload.supplierId
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
    const grnNumber = nextGrnNumber();
    const grn = await db.queryOne<{ id: string; grn_number: string; status: GrnStatus }>(
      `insert into inventory_grns (
         grn_number, status, supplier_id, bill_no, invoice_amount, lines_total, note, created_by
       ) values ($1, 'pending_approval', $2, $3, $4, $5, $6, $7)
       returning id, grn_number, status`,
      [
        grnNumber,
        input.payload.supplierId,
        input.payload.billNo || null,
        input.payload.invoiceAmount,
        input.payload.linesTotal,
        input.payload.note,
        input.userId
      ]
    );
    if (!grn) throw new Error("Could not create GRN");

    let sort = 0;
    for (const line of input.payload.lines) {
      const variant = await db.queryOne<{ id: string }>(
        `select id from product_variants where id = $1`,
        [line.productVariantId]
      );
      if (!variant) throw new Error(`Variant not found: ${line.productVariantId}`);

      const lineTotal = Math.round(line.quantity * line.purchasePrice * 100) / 100;
      await db.query(
        `insert into inventory_grn_lines (
           grn_id, product_variant_id, quantity, purchase_price, line_total, sort_order
         ) values ($1, $2, $3, $4, $5, $6)`,
        [grn.id, line.productVariantId, line.quantity, line.purchasePrice, lineTotal, sort++]
      );
    }

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
    lines_total: string | number;
    note: string | null;
  }>(`select * from inventory_grns where id = $1`, [grnId]);
  if (!grn) return null;

  const lines = await query<{
    product_variant_id: string;
    quantity: number;
    purchase_price: string | number;
  }>(
    `select product_variant_id, quantity, purchase_price
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

  const mapped = lines.map((l) => ({
    productVariantId: l.product_variant_id,
    quantity: Number(l.quantity),
    purchasePrice: Number(l.purchase_price)
  }));

  return {
    grn,
    payload: {
      supplierId: grn.supplier_id || "",
      supplierName,
      supplierMeta,
      billNo: grn.bill_no || "",
      invoiceAmount: Number(grn.invoice_amount || 0),
      extraNote: "",
      lines: mapped,
      linesTotal: Number(grn.lines_total || 0),
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
      }>(`select id, grn_number, status from inventory_grns where id = $1 for update`, [
        input.grnId
      ]);
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

      const applied = await applyApprovedGrnStock(db, {
        grnId: locked.id,
        userId: input.userId,
        payload: loaded.payload
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

export async function listGrns(filters: {
  status?: string | null;
  supplierId?: string | null;
  limit?: number;
}) {
  await ensureInventoryGrnSchema();
  const status = filters.status?.trim() || null;
  const supplierId = filters.supplierId?.trim() || null;
  const limit = Math.min(200, Math.max(1, filters.limit || 50));

  return query(
    `select g.id, g.grn_number, g.status, g.supplier_id, g.bill_no, g.invoice_amount,
            g.lines_total, g.note, g.created_by, g.approved_by, g.approved_at, g.created_at,
            s.name as supplier_name, s.code as supplier_code,
            (select count(*)::int from inventory_grn_lines l where l.grn_id = g.id) as line_count
     from inventory_grns g
     left join suppliers s on s.id = g.supplier_id
     where ($1::text is null or g.status = $1)
       and ($2::uuid is null or g.supplier_id = $2)
     order by g.created_at desc
     limit $3`,
    [status, supplierId, limit]
  );
}
