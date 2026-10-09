import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";
import {
  ensureColourName,
  ensureColoursSchema,
  listProductColours
} from "../../../../lib/colours";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "products:read",
    "products:manage",
    "stock:operate",
    "purchases:operate",
    "pos:create"
  ]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const q = String(searchParams.get("q") || "").trim();
  const activeOnly = searchParams.get("all") !== "1";
  const colours = await listProductColours({ activeOnly, q: q || undefined });
  return ok({ colours });
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requireAnyPermission(request, [
    "products:manage",
    "stock:operate",
    "purchases:operate",
    "pos:create"
  ]);
  if (error || !ctx) return error;

  await ensureColoursSchema();
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    hex?: string | null;
  } | null;
  const name = String(body?.name || "").trim();
  if (!name) return fail("Colour name is required");

  const colour = await ensureColourName(name, body?.hex ? String(body.hex).trim() : null);
  if (!colour) return fail("Could not save colour", 500);

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "product_colours",
    entityId: colour.id,
    after: colour
  });

  return ok(colour, 201);
}

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;

  await ensureColoursSchema();
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    name?: string;
    hex?: string | null;
    is_active?: boolean;
    sort_order?: number;
  } | null;
  const id = String(body?.id || "").trim();
  if (!id) return fail("id is required");

  const before = await queryOne(`select * from product_colours where id = $1`, [id]);
  if (!before) return fail("Colour not found", 404);

  const name = body?.name != null ? String(body.name).trim() : null;
  if (name === "") return fail("Colour name cannot be empty");

  const data = await queryOne(
    `update product_colours
     set name = coalesce($2, name),
         hex = case when $3::boolean then $4 else hex end,
         is_active = coalesce($5, is_active),
         sort_order = coalesce($6, sort_order),
         updated_at = now()
     where id = $1
     returning id, name, hex, sort_order, is_active`,
    [
      id,
      name,
      body?.hex !== undefined,
      body?.hex != null ? String(body.hex).trim() || null : null,
      body?.is_active == null ? null : Boolean(body.is_active),
      body?.sort_order == null || !Number.isFinite(Number(body.sort_order))
        ? null
        : Math.trunc(Number(body.sort_order))
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "product_colours",
    entityId: id,
    before,
    after: data
  });

  return ok(data);
}
