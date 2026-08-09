import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "cms:manage");
  if (error) return error;

  const data = await query(
    `select id, title, subtitle, media_path, media_type, sort_order, is_active, created_at, updated_at
     from showcase_media
     order by sort_order asc, created_at asc`
  );
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cms:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    subtitle?: string | null;
    media_path?: string;
    media_type?: "video" | "image";
    sort_order?: number;
    is_active?: boolean;
  } | null;

  if (!body?.title?.trim()) return fail("title is required");
  if (!body?.media_path) return fail("media_path is required");

  const mediaType = body.media_type === "image" ? "image" : "video";

  const data = await queryOne(
    `insert into showcase_media (title, subtitle, media_path, media_type, sort_order, is_active)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      body.title.trim(),
      body.subtitle?.trim() || null,
      body.media_path,
      mediaType,
      Number(body.sort_order || 0),
      body.is_active !== false
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "showcase_media",
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

  const before = await queryOne(`select * from showcase_media where id = $1`, [body.id]);
  if (!before) return fail("Showcase item not found", 404);

  const data = await queryOne(
    `update showcase_media set
       title = coalesce($2, title),
       subtitle = case when $3::boolean then $4 else subtitle end,
       media_path = coalesce($5, media_path),
       media_type = coalesce($6, media_type),
       sort_order = coalesce($7, sort_order),
       is_active = coalesce($8, is_active),
       updated_at = now()
     where id = $1
     returning *`,
    [
      body.id,
      typeof body.title === "string" ? body.title.trim() : null,
      body.subtitle !== undefined,
      typeof body.subtitle === "string" ? body.subtitle.trim() || null : null,
      typeof body.media_path === "string" ? body.media_path : null,
      body.media_type === "image" || body.media_type === "video" ? body.media_type : null,
      body.sort_order != null ? Number(body.sort_order) : null,
      typeof body.is_active === "boolean" ? body.is_active : null
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "showcase_media",
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

  const before = await queryOne(`select * from showcase_media where id = $1`, [id]);
  if (!before) return fail("Showcase item not found", 404);

  await queryOne(`delete from showcase_media where id = $1 returning id`, [id]);
  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "delete",
    entityType: "showcase_media",
    entityId: id,
    before
  });

  return ok({ deleted: id });
}
