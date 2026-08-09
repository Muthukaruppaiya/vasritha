import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "cms:manage");
  if (error) return error;

  const data = await query(
    `select id, message, link_url, sort_order, is_active, created_at, updated_at
     from offer_ticker_items
     order by sort_order asc, created_at asc`
  );
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cms:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    message?: string;
    link_url?: string | null;
    sort_order?: number;
    is_active?: boolean;
  } | null;

  if (!body?.message?.trim()) return fail("message is required");

  const data = await queryOne(
    `insert into offer_ticker_items (message, link_url, sort_order, is_active)
     values ($1, $2, $3, $4)
     returning *`,
    [
      body.message.trim(),
      body.link_url?.trim() || null,
      Number(body.sort_order || 0),
      body.is_active !== false
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "offer_ticker_items",
    entityId: (data as { id: string })?.id,
    after: data
  });

  return ok(data);
}

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cms:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    message?: string;
    link_url?: string | null;
    sort_order?: number;
    is_active?: boolean;
  } | null;

  if (!body?.id) return fail("id is required");
  const before = await queryOne(`select * from offer_ticker_items where id = $1`, [body.id]);
  if (!before) return fail("Offer not found", 404);

  const data = await queryOne(
    `update offer_ticker_items set
       message = coalesce($2, message),
       link_url = case when $3::boolean then $4 else link_url end,
       sort_order = coalesce($5, sort_order),
       is_active = coalesce($6, is_active),
       updated_at = now()
     where id = $1
     returning *`,
    [
      body.id,
      body.message?.trim() || null,
      body.link_url !== undefined,
      body.link_url?.trim() || null,
      body.sort_order != null ? Number(body.sort_order) : null,
      body.is_active ?? null
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "offer_ticker_items",
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

  const before = await queryOne(`select * from offer_ticker_items where id = $1`, [id]);
  if (!before) return fail("Offer not found", 404);

  await queryOne(`delete from offer_ticker_items where id = $1 returning id`, [id]);
  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "delete",
    entityType: "offer_ticker_items",
    entityId: id,
    before
  });

  return ok({ deleted: id });
}
