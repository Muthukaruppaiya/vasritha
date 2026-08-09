import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";

const MAX_ACTIVE = 5;

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "cms:manage");
  if (error) return error;

  const data = await query(
    `select id, image_path, alt_text, title, subtitle,
            cta_label, cta_href, cta2_label, cta2_href,
            sort_order, is_active, created_at, updated_at
     from hero_slides
     order by sort_order asc, created_at asc`
  );
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cms:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.image_path || typeof body.image_path !== "string") {
    return fail("image_path is required");
  }

  const activeCount = await queryOne<{ count: string }>(
    `select count(*)::text as count from hero_slides where is_active = true`
  );
  const willBeActive = body.is_active !== false;
  if (willBeActive && Number(activeCount?.count || 0) >= MAX_ACTIVE) {
    return fail(`Only ${MAX_ACTIVE} active hero slides are allowed`);
  }

  const data = await queryOne(
    `insert into hero_slides (
       image_path, alt_text, title, subtitle,
       cta_label, cta_href, cta2_label, cta2_href, sort_order, is_active
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     returning *`,
    [
      body.image_path,
      (body.alt_text as string) || null,
      (body.title as string) || null,
      (body.subtitle as string) || null,
      (body.cta_label as string) || null,
      (body.cta_href as string) || null,
      (body.cta2_label as string) || null,
      (body.cta2_href as string) || null,
      Number(body.sort_order || 0),
      willBeActive
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "hero_slides",
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

  const before = await queryOne<{ id: string; is_active: boolean }>(
    `select * from hero_slides where id = $1`,
    [body.id]
  );
  if (!before) return fail("Slide not found", 404);

  if (body.is_active === true && !before.is_active) {
    const activeCount = await queryOne<{ count: string }>(
      `select count(*)::text as count from hero_slides where is_active = true`
    );
    if (Number(activeCount?.count || 0) >= MAX_ACTIVE) {
      return fail(`Only ${MAX_ACTIVE} active hero slides are allowed`);
    }
  }

  const data = await queryOne(
    `update hero_slides set
       image_path = coalesce($2, image_path),
       alt_text = case when $3::boolean then $4 else alt_text end,
       title = case when $5::boolean then $6 else title end,
       subtitle = case when $7::boolean then $8 else subtitle end,
       cta_label = case when $9::boolean then $10 else cta_label end,
       cta_href = case when $11::boolean then $12 else cta_href end,
       cta2_label = case when $13::boolean then $14 else cta2_label end,
       cta2_href = case when $15::boolean then $16 else cta2_href end,
       sort_order = coalesce($17, sort_order),
       is_active = coalesce($18, is_active),
       updated_at = now()
     where id = $1
     returning *`,
    [
      body.id,
      typeof body.image_path === "string" ? body.image_path : null,
      body.alt_text !== undefined,
      (body.alt_text as string) || null,
      body.title !== undefined,
      (body.title as string) || null,
      body.subtitle !== undefined,
      (body.subtitle as string) || null,
      body.cta_label !== undefined,
      (body.cta_label as string) || null,
      body.cta_href !== undefined,
      (body.cta_href as string) || null,
      body.cta2_label !== undefined,
      (body.cta2_label as string) || null,
      body.cta2_href !== undefined,
      (body.cta2_href as string) || null,
      body.sort_order != null ? Number(body.sort_order) : null,
      typeof body.is_active === "boolean" ? body.is_active : null
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "hero_slides",
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

  const before = await queryOne(`select * from hero_slides where id = $1`, [id]);
  if (!before) return fail("Slide not found", 404);

  await queryOne(`delete from hero_slides where id = $1 returning id`, [id]);
  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "delete",
    entityType: "hero_slides",
    entityId: id,
    before
  });

  return ok({ deleted: id });
}
