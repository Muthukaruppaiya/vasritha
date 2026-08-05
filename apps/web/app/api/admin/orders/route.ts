import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

const FULFILLMENT_STATUSES = new Set(["confirmed", "processing", "shipped", "delivered"]);

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "orders:view",
    "orders:manage",
    "orders:fulfill",
    "pos:create"
  ]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const channel = searchParams.get("channel");
  const paymentStatus = searchParams.get("paymentStatus");

  const data = await query(
    `select o.id, o.order_number, o.customer_id, o.status, o.payment_status, o.subtotal,
            coalesce(o.discount_amount, 0) as discount_amount,
            o.tax_amount, o.shipping_amount, o.total_amount,
            coalesce(o.channel, 'online') as channel, o.created_at,
            c.full_name as customer_name, c.email as customer_email, c.phone as customer_phone
     from orders o
     left join customers c on c.id = o.customer_id
     where ($1::text is null or o.status::text = $1)
       and ($2::text is null or coalesce(o.channel, 'online') = $2)
       and ($3::text is null or o.payment_status::text = $3)
     order by o.created_at desc
     limit 100`,
    [status, channel, paymentStatus]
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
