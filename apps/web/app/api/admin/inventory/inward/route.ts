import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, writeAuditLog } from "../../../../../lib/auth/api";
import { hasPermission } from "../../../../../lib/auth/rbac";
import {
  approveGrnOnce,
  createPendingGrn,
  ensureInventoryGrnSchema,
  parseAndValidateGrnBody
} from "../../../../../lib/inventory-grn";

/**
 * GRN / stock inward submit.
 * Creates a pending GRN. Stock updates only after approval
 * (approveNow for managers, or bulk approve via /api/admin/inventory/grn/approve).
 */
export async function POST(request: NextRequest) {
  const { error, ctx } = await requireAnyPermission(request, [
    "stock:operate",
    "purchases:operate",
    "stock:approve"
  ]);
  if (error || !ctx) return error;

  await ensureInventoryGrnSchema();

  const body = (await request.json().catch(() => null)) as {
    supplier?: string;
    supplierId?: string;
    billNo?: string;
    note?: string;
    invoiceAmount?: number;
    approveNow?: boolean;
    lines?: Array<{ productVariantId?: string; quantity?: number; purchasePrice?: number }>;
  } | null;

  if (!body) return fail("Invalid body");

  const parsed = await parseAndValidateGrnBody(body);
  if (!parsed.ok) return fail(parsed.error);

  const wantApproveNow = Boolean(body.approveNow);
  const canApprove = hasPermission(ctx.roles, "stock:approve");
  if (wantApproveNow && !canApprove) {
    return fail("Only managers can approve GRNs immediately", 403);
  }

  try {
    const grn = await createPendingGrn({
      userId: ctx.userId,
      payload: parsed.data
    });

    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "inventory_grn_submit",
      entityType: "inventory_grns",
      entityId: grn.id,
      after: {
        grn_number: grn.grn_number,
        status: grn.status,
        supplierId: parsed.data.supplierId,
        billNo: parsed.data.billNo || null,
        invoiceAmount: parsed.data.invoiceAmount,
        linesTotal: parsed.data.linesTotal,
        lineCount: parsed.data.lines.length
      }
    });

    let approved: Awaited<ReturnType<typeof approveGrnOnce>> | null = null;
    if (wantApproveNow && canApprove) {
      approved = await approveGrnOnce({ grnId: grn.id, userId: ctx.userId });
      if (approved.ok) {
        await writeAuditLog({
          actorUserId: ctx.userId,
          action: "inventory_inward",
          entityType: "inventory_grns",
          entityId: grn.id,
          after: {
            grn_number: grn.grn_number,
            supplierId: parsed.data.supplierId,
            billNo: parsed.data.billNo || null,
            invoiceAmount: parsed.data.invoiceAmount,
            linesTotal: parsed.data.linesTotal,
            units: approved.units,
            movements: approved.movements,
            approvedInline: true
          }
        });
      } else {
        return ok(
          {
            id: grn.id,
            grn_number: grn.grn_number,
            status: "pending_approval",
            pending: true,
            count: 0,
            approveError: approved.error,
            invoiceAmount: parsed.data.invoiceAmount,
            linesTotal: parsed.data.linesTotal
          },
          201
        );
      }
    }

    if (approved?.ok) {
      return ok(
        {
          id: grn.id,
          grn_number: grn.grn_number,
          status: "approved",
          pending: false,
          count: approved.movements,
          units: approved.units,
          invoiceAmount: parsed.data.invoiceAmount,
          linesTotal: parsed.data.linesTotal
        },
        201
      );
    }

    return ok(
      {
        id: grn.id,
        grn_number: grn.grn_number,
        status: "pending_approval",
        pending: true,
        count: 0,
        invoiceAmount: parsed.data.invoiceAmount,
        linesTotal: parsed.data.linesTotal,
        message: "GRN submitted for approval. Stock will update after manager approval."
      },
      201
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Inward failed";
    return fail(message, message.startsWith("Variant not found") ? 404 : 400);
  }
}
