import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const placement = new URL(request.url).searchParams.get("placement");

  const data = await query(
    `select * from banners
     where is_active = true and ($1::text is null or placement = $1)
     order by sort_order`,
    [placement]
  );
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cms:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.image_path) return fail("image_path is required");

  const data = await queryOne(
    `insert into banners (title, subtitle, image_path, link_url, placement, sort_order, is_active)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      body.title ?? null,
      body.subtitle ?? null,
      body.image_path,
      body.link_url ?? null,
      body.placement ?? "home_hero",
      body.sort_order ?? 0,
      body.is_active ?? true
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "banners",
    entityId: (data as { id: string }).id,
    after: data
  });
  return ok(data, 201);
}
