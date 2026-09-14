import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { withTransaction } from "../../../../../lib/db/pool";
import {
  createProductUnits,
  ensureProductUnitsSchema,
  syncSellableStock
} from "../../../../../lib/product-units";
import { ensureSuppliersSchema, getSupplierById, supplierLabel } from "../../../../../lib/suppliers";

type InwardLine = {
  productVariantId?: string;
  quantity?: number;
  purchasePrice?: number;
};

/**
 * Simple GRN / stock inward:
 * posts one `purchase` movement per line and increments variant stock.
 */
export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "stock:operate");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    supplier?: string;
    supplierId?: string;
    billNo?: string;
    note?: string;
    invoiceAmount?: number;
    lines?: InwardLine[];
  } | null;

  const lines = (body?.lines || [])
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
    return fail("Add at least one line with variant and quantity > 0");
  }

  for (const line of lines) {
    if (!Number.isFinite(line.purchasePrice) || line.purchasePrice < 0) {
      return fail("Enter purchase price (₹) for every line");
    }
  }

  const supplierId = String(body?.supplierId || "").trim() || null;
  let supplierName = (body?.supplier || "").trim();
  let supplierMeta = "";

  await ensureSuppliersSchema();
  if (supplierId) {
    const supplier = await getSupplierById(supplierId);
    if (!supplier || !supplier.is_active) {
      return fail("Select an active supplier from Supplier Master", 400);
    }
    supplierName = supplierLabel(supplier);
    supplierMeta = [
      supplier.gstin ? `GSTIN ${supplier.gstin}` : "",
      supplier.pan ? `PAN ${supplier.pan}` : "",
      supplier.state ? `State ${supplier.state}` : "",
      supplier.state_code ? `State code ${supplier.state_code}` : ""
    ]
      .filter(Boolean)
      .join(" · ");
  }

  const billNo = (body?.billNo || "").trim();
  const extraNote = (body?.note || "").trim();
  const invoiceAmountRaw = body?.invoiceAmount;
  const invoiceAmount =
    invoiceAmountRaw == null || invoiceAmountRaw === ("" as unknown)
      ? null
      : Number(invoiceAmountRaw);
  if (invoiceAmount != null && (!Number.isFinite(invoiceAmount) || invoiceAmount < 0)) {
    return fail("Invoice amount must be a valid number");
  }

  const computedTotal = lines.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.purchasePrice * 100) / 100,
    0
  );

  const noteParts = [
    supplierName ? `Supplier: ${supplierName}` : "",
    supplierMeta,
    billNo ? `Bill: ${billNo}` : "",
    invoiceAmount != null ? `Invoice amt: ₹${invoiceAmount.toFixed(2)}` : "",
    `Lines total: ₹${computedTotal.toFixed(2)}`,
    extraNote
  ].filter(Boolean);
  const note = noteParts.join(" · ") || null;

  await ensureProductUnitsSchema();

  try {
    const result = await withTransaction(async (db) => {
      const movements: Array<Record<string, unknown>> = [];
      const updated: Array<{
        productVariantId: string;
        stockQuantity: number;
        unitsCreated: number;
        purchasePrice: number;
        lineTotal: number;
      }> = [];
      const createdItems: Array<Record<string, unknown>> = [];

      for (const line of lines) {
        const variant = await db.queryOne<{
          id: string;
          product_id: string;
          sku: string;
        }>(
          `select id, product_id, sku from product_variants where id = $1 for update`,
          [line.productVariantId]
        );
        if (!variant) {
          throw new Error(`Variant not found: ${line.productVariantId}`);
        }

        const tagged = await db.queryOne<{ tag: string | null; sku: string | null }>(
          `select tag, sku from products where id = $1`,
          [variant.product_id]
        );

        const qty = Math.trunc(Math.abs(line.quantity));
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

        const lineNote = [
          note,
          `Purchase @ ₹${Number(line.purchasePrice).toFixed(2)}`,
          `Line total ₹${(Math.round(line.quantity * line.purchasePrice * 100) / 100).toFixed(2)}`
        ]
          .filter(Boolean)
          .join(" · ");

        const movement = await db.queryOne(
          `insert into inventory_movements
             (product_variant_id, type, quantity, reference_type, note, created_by, supplier_id)
           values ($1, 'purchase', $2, 'grn', $3, $4, $5)
           returning *`,
          [line.productVariantId, qty, lineNote, ctx.userId, supplierId]
        );

        if (movement) movements.push(movement as Record<string, unknown>);
        updated.push({
          productVariantId: line.productVariantId,
          stockQuantity: Number(stockRow?.stock_quantity || 0),
          unitsCreated: items.length,
          purchasePrice: line.purchasePrice,
          lineTotal: Math.round(line.quantity * line.purchasePrice * 100) / 100
        });
      }

      return { movements, updated, createdItems, computedTotal, invoiceAmount };
    });

    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "inventory_inward",
      entityType: "inventory_movements",
      entityId: (result.movements[0] as { id?: string } | undefined)?.id,
      after: {
        supplierId: supplierId || null,
        supplier: supplierName || null,
        billNo: billNo || null,
        invoiceAmount: result.invoiceAmount,
        linesTotal: result.computedTotal,
        note,
        lines: result.updated,
        units: result.createdItems.length
      }
    });

    return ok(
      {
        count: result.movements.length,
        movements: result.movements,
        stock: result.updated,
        items: result.createdItems,
        invoiceAmount: result.invoiceAmount,
        linesTotal: result.computedTotal
      },
      201
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Inward failed";
    return fail(message, message.startsWith("Variant not found") ? 404 : 400);
  }
}
