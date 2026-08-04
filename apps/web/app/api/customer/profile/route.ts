import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../lib/auth/api";
import { queryOne } from "../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "profile:own");
  if (error || !ctx) return error;

  const data = await queryOne(
    `select id, full_name, email, phone, created_at from customers where id = $1`,
    [ctx.userId]
  );

  return ok(data);
}

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "profile:own");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    fullName?: string;
    phone?: string;
  } | null;

  const data = await queryOne(
    `update customers
     set full_name = coalesce($2, full_name),
         phone = coalesce($3, phone)
     where id = $1
     returning id, full_name, email, phone, created_at`,
    [ctx.userId, body?.fullName ?? null, body?.phone ?? null]
  );

  return ok(data);
}
