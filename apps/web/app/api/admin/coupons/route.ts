import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, ["pricing:manage", "pricing:limited"]);
  if (error) return error;

  const data = await query(`select * from coupons order by created_at desc`);
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "pricing:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.code || !body?.discount_type || body.discount_value == null) {
    return fail("code, discount_type and discount_value are required");
  }

  const data = await queryOne(
    `insert into coupons (
       code, description, discount_type, discount_value, min_order_amount,
       max_discount_amount, usage_limit, usage_limit_per_customer, starts_at, ends_at, status
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning *`,
    [
      String(body.code).toUpperCase(),
      body.description ?? null,
      body.discount_type,
      Number(body.discount_value),
      Number(body.min_order_amount ?? 0),
      body.max_discount_amount != null ? Number(body.max_discount_amount) : null,
      body.usage_limit != null ? Number(body.usage_limit) : null,
      body.usage_limit_per_customer != null ? Number(body.usage_limit_per_customer) : null,
      body.starts_at ?? null,
      body.ends_at ?? null,
      body.status ?? "active"
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "coupons",
    entityId: (data as { id: string }).id,
    after: data
  });
  return ok(data, 201);
}
