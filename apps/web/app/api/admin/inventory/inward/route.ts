import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { withTransaction } from "../../../../../lib/db/pool";

type InwardLine = {
  productVariantId?: string;
  quantity?: number;
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
    billNo?: string;
    note?: string;
    lines?: InwardLine[];
  } | null;

  const lines = (body?.lines || [])
    .map((line) => ({
      productVariantId: String(line.productVariantId || "").trim(),
      quantity: Number(line.quantity)
    }))
    .filter((line) => line.productVariantId && Number.isFinite(line.quantity) && line.quantity > 0);

  if (!lines.length) {
    return fail("Add at least one line with variant and quantity > 0");
  }

  const supplier = (body?.supplier || "").trim();
  const billNo = (body?.billNo || "").trim();
  const extraNote = (body?.note || "").trim();
  const noteParts = [
    supplier ? `Supplier: ${supplier}` : "",
    billNo ? `Bill: ${billNo}` : "",
    extraNote
  ].filter(Boolean);
  const note = noteParts.join(" · ") || null;

  try {
    const result = await withTransaction(async (db) => {
      const movements: Array<Record<string, unknown>> = [];
      const updated: Array<{ productVariantId: string; stockQuantity: number }> = [];

      for (const line of lines) {
        const variant = await db.queryOne<{ id: string; stock_quantity: number }>(
          `select id, stock_quantity from product_variants where id = $1 for update`,
          [line.productVariantId]
        );
        if (!variant) {
          throw new Error(`Variant not found: ${line.productVariantId}`);
        }

        const qty = Math.trunc(Math.abs(line.quantity));
        const nextQty = Number(variant.stock_quantity) + qty;

        const movement = await db.queryOne(
          `insert into inventory_movements
             (product_variant_id, type, quantity, reference_type, note, created_by)
           values ($1, 'purchase', $2, 'grn', $3, $4)
           returning *`,
          [line.productVariantId, qty, note, ctx.userId]
        );

        await db.query(`update product_variants set stock_quantity = $2 where id = $1`, [
          line.productVariantId,
          nextQty
        ]);

        if (movement) movements.push(movement as Record<string, unknown>);
        updated.push({ productVariantId: line.productVariantId, stockQuantity: nextQty });
      }

      return { movements, updated };
    });

    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "inventory_inward",
      entityType: "inventory_movements",
      entityId: (result.movements[0] as { id?: string } | undefined)?.id,
      after: {
        supplier: supplier || null,
        billNo: billNo || null,
        note,
        lines: result.updated
      }
    });

    return ok(
      {
        count: result.movements.length,
        movements: result.movements,
        stock: result.updated
      },
      201
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Inward failed";
    return fail(message, message.startsWith("Variant not found") ? 404 : 400);
  }
}
