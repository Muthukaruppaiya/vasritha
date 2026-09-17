import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import type { AppRole } from "../../../../../lib/auth/rbac";
import { query, queryOne } from "../../../../../lib/db/pool";
import {
  canApproveProducts,
  ensureProductStatusEnum,
  normalizeProductStatus,
  type ProductStatus
} from "../../../../../lib/product-status";

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;

  await ensureProductStatusEnum();

  const body = (await request.json().catch(() => null)) as {
    ids?: string[];
    status?: string;
  } | null;

  const ids = Array.isArray(body?.ids)
    ? body!.ids.filter((id) => typeof id === "string" && id.length > 0)
    : [];
  if (!ids.length) return fail("Select at least one product");

  const canApprove = canApproveProducts((ctx.roles || []) as AppRole[]);
  const requested = String(body?.status || "").toLowerCase();

  if ((requested === "active" || requested === "rejected") && !canApprove) {
    return fail("Only a manager can approve or reject products", 403);
  }

  const status = normalizeProductStatus(requested, {
    canApprove,
    fallback: "pending_approval"
  }) as ProductStatus;

  const updated: string[] = [];
  for (const id of ids) {
    const before = await queryOne(`select id, status, name from products where id = $1`, [id]);
    if (!before) continue;
    const data = await queryOne(
      `update products set status = $2::product_status, updated_at = now() where id = $1 returning id, status, name`,
      [id, status]
    );
    if (!data) continue;
    updated.push(id);
    await writeAuditLog({
      actorUserId: ctx.userId,
      action: status === "active" ? "approve" : status === "rejected" ? "reject" : "update",
      entityType: "products",
      entityId: id,
      before,
      after: data
    });
  }

  return ok({ updatedCount: updated.length, status, ids: updated });
}
