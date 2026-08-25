import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "pricing:manage");
  if (error || !ctx) return error;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail("Invalid body");

  const before = await queryOne(`select * from coupons where id = $1`, [id]);
  if (!before) return fail("Coupon not found", 404);

  if (body.show_on_open === true) {
    await query(`update coupons set show_on_open = false where id <> $1`, [id]);
  }

  const allowed = [
    "status",
    "show_on_open",
    "headline",
    "description",
    "kind"
  ] as const;
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in body) {
      values.push(body[key]);
      updates.push(`${key} = $${values.length}`);
    }
  }
  if (!updates.length) return ok(before);

  values.push(id);
  const data = await queryOne(
    `update coupons set ${updates.join(", ")} where id = $${values.length} returning *`,
    values
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "coupons",
    entityId: id,
    before,
    after: data
  });
  return ok(data);
}
