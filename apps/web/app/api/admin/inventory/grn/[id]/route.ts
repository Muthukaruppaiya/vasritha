import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, writeAuditLog } from "../../../../../../lib/auth/api";
import {
  getGrnPrintDetail,
  parseAndValidateGrnBody,
  updatePendingGrn
} from "../../../../../../lib/inventory-grn";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(request, [
    "stock:operate",
    "stock:approve",
    "purchases:operate"
  ]);
  if (error) return error;

  const { id } = await context.params;
  if (!id) return fail("GRN id required", 400);

  const data = await getGrnPrintDetail(id);
  if (!data) return fail("GRN not found", 404);
  return ok(data);
}

/** Change a GRN while it is still waiting for approval. Stock is not moved. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error, ctx } = await requireAnyPermission(request, [
    "stock:operate",
    "purchases:operate",
    "stock:approve"
  ]);
  if (error || !ctx) return error;

  const { id } = await context.params;
  if (!id) return fail("GRN id required", 400);

  const body = (await request.json().catch(() => null)) as {
    supplier?: string;
    supplierId?: string;
    billNo?: string;
    note?: string;
    invoiceAmount?: number;
    invoiceDate?: string;
    documentPath?: string;
    lines?: Array<{ productVariantId?: string; quantity?: number; purchasePrice?: number }>;
  } | null;
  if (!body) return fail("Invalid body");

  const parsed = await parseAndValidateGrnBody(body);
  if (!parsed.ok) return fail(parsed.error);

  try {
    const grn = await updatePendingGrn({ grnId: id, payload: parsed.data });
    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "inventory_grn_update",
      entityType: "inventory_grns",
      entityId: grn.id,
      after: {
        grn_number: grn.grn_number,
        status: grn.status,
        billNo: parsed.data.billNo || null,
        invoiceAmount: parsed.data.invoiceAmount,
        linesTotal: parsed.data.linesTotal,
        lineCount: parsed.data.lines.length
      }
    });
    return ok({ ...grn, pending: true });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not update GRN", 400);
  }
}
