import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "cms:manage");
  if (error) return error;

  const data = await query(
    `select id, label, image_path, href, display_date::text as display_date,
            sort_order, is_active, created_at, updated_at
     from status_stories
     order by display_date desc, sort_order asc, created_at asc`
  );
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cms:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    label?: string;
    image_path?: string;
    href?: string | null;
    display_date?: string;
    sort_order?: number;
    is_active?: boolean;
  } | null;

  if (!body?.label?.trim()) return fail("label is required");
  if (!body?.image_path) return fail("image_path is required");
  if (!body?.display_date) return fail("display_date is required (1-day validity)");

  const data = await queryOne(
    `insert into status_stories (label, image_path, href, display_date, sort_order, is_active)
     values ($1, $2, $3, $4::date, $5, $6)
     returning id, label, image_path, href, display_date::text as display_date,
               sort_order, is_active, created_at, updated_at`,
    [
      body.label.trim(),
      body.image_path,
      body.href?.trim() || null,
      body.display_date,
      Number(body.sort_order || 0),
      body.is_active !== false
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "status_stories",
    entityId: (data as { id: string })?.id,
    after: data
  });

  return ok(data);
}

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cms:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.id || typeof body.id !== "string") return fail("id is required");

  const before = await queryOne(`select * from status_stories where id = $1`, [body.id]);
  if (!before) return fail("Status story not found", 404);

  const data = await queryOne(
    `update status_stories set
       label = coalesce($2, label),
       image_path = coalesce($3, image_path),
       href = case when $4::boolean then $5 else href end,
       display_date = coalesce($6::date, display_date),
       sort_order = coalesce($7, sort_order),
       is_active = coalesce($8, is_active),
       updated_at = now()
     where id = $1
     returning id, label, image_path, href, display_date::text as display_date,
               sort_order, is_active, created_at, updated_at`,
    [
      body.id,
      typeof body.label === "string" ? body.label.trim() : null,
      typeof body.image_path === "string" ? body.image_path : null,
      body.href !== undefined,
      typeof body.href === "string" ? body.href.trim() || null : null,
      typeof body.display_date === "string" ? body.display_date : null,
      body.sort_order != null ? Number(body.sort_order) : null,
      typeof body.is_active === "boolean" ? body.is_active : null
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "status_stories",
    entityId: body.id,
    before,
    after: data
  });

  return ok(data);
}

export async function DELETE(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cms:manage");
  if (error || !ctx) return error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("id is required");

  const before = await queryOne(`select * from status_stories where id = $1`, [id]);
  if (!before) return fail("Status story not found", 404);

  await queryOne(`delete from status_stories where id = $1 returning id`, [id]);
  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "delete",
    entityType: "status_stories",
    entityId: id,
    before
  });

  return ok({ deleted: id });
}
