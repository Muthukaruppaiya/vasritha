import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "products:read");
  if (error) return error;

  const categoryId = new URL(request.url).searchParams.get("category_id");
  const data = await query(
    `select id, category_id, name, slug, sort_order
     from subcategories
     where ($1::uuid is null or category_id = $1)
     order by sort_order asc, name asc`,
    [categoryId || null]
  );
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "categories:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    category_id?: string;
    name?: string;
    slug?: string;
    sort_order?: number;
  } | null;

  if (!body?.category_id || !body?.name || !body?.slug) {
    return fail("category_id, name and slug are required");
  }

  const parent = await queryOne<{ id: string }>(`select id from categories where id = $1`, [
    body.category_id
  ]);
  if (!parent) return fail("Parent category not found", 404);

  try {
    const data = await queryOne(
      `insert into subcategories (category_id, name, slug, sort_order)
       values ($1, $2, $3, $4)
       returning *`,
      [body.category_id, body.name.trim(), body.slug, body.sort_order ?? 0]
    );

    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "create",
      entityType: "subcategories",
      entityId: (data as { id: string }).id,
      after: data
    });

    return ok(data, 201);
  } catch {
    return fail("Could not create subcategory. Name or slug may already exist.", 409);
  }
}
