import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { queryOne } from "../../../../../lib/db/pool";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "categories:manage");
  if (error || !ctx) return error;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    slug?: string;
    sort_order?: number;
  } | null;
  if (!body) return fail("Invalid body");

  const before = await queryOne(`select * from subcategories where id = $1`, [id]);
  if (!before) return fail("Subcategory not found", 404);

  const updates: string[] = [];
  const values: unknown[] = [];
  for (const key of ["name", "slug", "sort_order"] as const) {
    if (key in body && body[key] !== undefined) {
      values.push(key === "name" ? String(body[key]).trim() : body[key]);
      updates.push(`${key} = $${values.length}`);
    }
  }
  if (!updates.length) return ok(before);

  values.push(id);
  try {
    const data = await queryOne(
      `update subcategories set ${updates.join(", ")} where id = $${values.length} returning *`,
      values
    );

    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "update",
      entityType: "subcategories",
      entityId: id,
      before,
      after: data
    });
    return ok(data);
  } catch {
    return fail("Could not update subcategory. Name or slug may already exist.", 409);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "categories:manage");
  if (error || !ctx) return error;
  const { id } = await params;

  const before = await queryOne(`select * from subcategories where id = $1`, [id]);
  if (!before) return fail("Subcategory not found", 404);

  const linked = await queryOne<{ count: string }>(
    `select count(*)::text as count from products where subcategory_id = $1`,
    [id]
  );
  if (Number(linked?.count || 0) > 0) {
    return fail("Cannot delete while products are assigned to this subcategory.", 409);
  }

  await queryOne(`delete from subcategories where id = $1 returning id`, [id]);

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "delete",
    entityType: "subcategories",
    entityId: id,
    before
  });
  return ok({ deleted: id });
}
