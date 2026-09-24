import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, writeAuditLog } from "../../../../../lib/auth/api";
import { hasPermission } from "../../../../../lib/auth/rbac";
import {
  approveGrnOnce,
  createPendingGrn,
  ensureInventoryGrnSchema,
  listGrns,
  parseAndValidateGrnBody
} from "../../../../../lib/inventory-grn";

/**
 * Submit a GRN for approval. Stock is applied only when approved
 * (via approveNow or POST /api/admin/inventory/grn/approve).
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
      }
    }

    return ok(
      {
        id: grn.id,
        grn_number: grn.grn_number,
        status: approved?.ok ? "approved" : grn.status,
        pending: !(approved?.ok),
        approved: approved?.ok
          ? { units: approved.units, movements: approved.movements }
          : null,
        approveError: approved && !approved.ok ? approved.error : null,
        invoiceAmount: parsed.data.invoiceAmount,
        linesTotal: parsed.data.linesTotal
      },
      201
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "GRN submit failed";
    return fail(message, 400);
  }
}

/** List GRNs (default: pending_approval). */
export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "stock:operate",
    "stock:approve",
    "purchases:operate"
  ]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const supplierId = searchParams.get("supplierId");

  const data = await listGrns({
    status: status === "all" ? null : status || "pending_approval",
    supplierId
  });
  return ok(data);
}
