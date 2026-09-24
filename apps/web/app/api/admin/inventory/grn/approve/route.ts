import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../../lib/auth/api";
import { approveGrnOnce, ensureInventoryGrnSchema } from "../../../../../../lib/inventory-grn";

/**
 * Approve one or many pending GRNs. Stock is applied once per GRN inside a
 * per-record transaction; already-approved rows are skipped without re-applying stock.
 */
export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "stock:approve");
  if (error || !ctx) return error;

  await ensureInventoryGrnSchema();

  const body = (await request.json().catch(() => null)) as {
    ids?: string[];
    id?: string;
  } | null;

  const ids = Array.isArray(body?.ids)
    ? body!.ids.filter((id) => typeof id === "string" && id.trim().length > 0).map((id) => id.trim())
    : body?.id
      ? [String(body.id).trim()]
      : [];

  const uniqueIds = Array.from(new Set(ids));
  if (!uniqueIds.length) return fail("Select at least one GRN to approve");

  const succeeded: Array<{ id: string; grn_number: string; units: number; movements: number }> = [];
  const failed: Array<{ id: string; grn_number?: string; error: string }> = [];

  for (const id of uniqueIds) {
    const result = await approveGrnOnce({ grnId: id, userId: ctx.userId });
    if (result.ok) {
      succeeded.push({
        id,
        grn_number: result.grn_number,
        units: result.units,
        movements: result.movements
      });
      await writeAuditLog({
        actorUserId: ctx.userId,
        action: "inventory_inward",
        entityType: "inventory_grns",
        entityId: id,
        after: {
          grn_number: result.grn_number,
          units: result.units,
          movements: result.movements,
          bulkApprove: true
        }
      });
    } else {
      failed.push({
        id,
        grn_number: result.grn_number,
        error: result.error
      });
    }
  }

  return ok({
    requested: uniqueIds.length,
    succeededCount: succeeded.length,
    failedCount: failed.length,
    succeeded,
    failed
  });
}
