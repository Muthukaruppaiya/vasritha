import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { queryOne } from "../../../../../lib/db/pool";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_FIELDS = ["name", "slug", "description", "image_path", "sort_order"] as const;

export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "categories:manage");
  if (error || !ctx) return error;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail("Invalid body");

  const before = await queryOne(`select * from categories where id = $1`, [id]);
  if (!before) return fail("Category not found", 404);

  const updates: string[] = [];
  const values: unknown[] = [];
  for (const key of ALLOWED_FIELDS) {
    if (key in body) {
      values.push(body[key]);
      updates.push(`${key} = $${values.length}`);
    }
  }

  if (!updates.length) return ok(before);

  values.push(id);
  const data = await queryOne(
    `update categories set ${updates.join(", ")} where id = $${values.length} returning *`,
    values
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "categories",
    entityId: id,
    before,
    after: data
  });
  return ok(data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "categories:manage");
  if (error || !ctx) return error;
  const { id } = await params;

  const before = await queryOne(`select * from categories where id = $1`, [id]);
  if (!before) return fail("Category not found", 404);

  const linked = await queryOne<{ count: string }>(
    `select count(*)::text as count from products where category_id = $1`,
    [id]
  );
  if (Number(linked?.count || 0) > 0) {
    return fail("Cannot delete category while products are assigned to it. Move or delete those products first.", 409);
  }

  try {
    await queryOne(`delete from categories where id = $1 returning id`, [id]);
  } catch {
    return fail("Could not delete category. It may still be referenced by other records.", 409);
  }

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "delete",
    entityType: "categories",
    entityId: id,
    before
  });
  return ok({ deleted: id });
}
