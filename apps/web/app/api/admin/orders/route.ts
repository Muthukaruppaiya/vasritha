import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

const FULFILLMENT_STATUSES = new Set(["confirmed", "processing", "shipped", "delivered"]);

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, ["orders:view", "orders:manage", "orders:fulfill"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const data = await query(
    `select id, order_number, customer_id, status, payment_status, subtotal, tax_amount, shipping_amount, total_amount, created_at
     from orders
     where ($1::text is null or status::text = $1)
     order by created_at desc
     limit 100`,
    [status]
  );
  return ok(data);
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    orderId?: string;
    status?: string;
  } | null;

  if (!body?.orderId || !body?.status) return fail("orderId and status are required");

  const wantsFulfillment = FULFILLMENT_STATUSES.has(body.status);
  const { error, ctx } = wantsFulfillment
    ? await requireAnyPermission(request, ["orders:fulfill", "orders:manage"])
    : await requirePermission(request, "orders:manage");

  if (error || !ctx) return error;

  const before = await queryOne(`select * from orders where id = $1`, [body.orderId]);
  if (!before) return fail("Order not found", 404);

  const data = await queryOne(
    `update orders set status = $2 where id = $1 returning *`,
    [body.orderId, body.status]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update_status",
    entityType: "orders",
    entityId: body.orderId,
    before,
    after: data
  });

  return ok(data);
}
