import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";
import { ensureOrderCourierSchema } from "../../../../lib/order-courier";
import {
  isAllowedOrderTransition,
  isOrderStatus,
  ORDER_FULFILLMENT_STATUSES,
  orderStatusLabel
} from "../../../../lib/order-status";

const FULFILLMENT_STATUSES = new Set<string>(ORDER_FULFILLMENT_STATUSES);

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "orders:view",
    "orders:manage",
    "orders:fulfill",
    "pos:create"
  ]);
  if (error) return error;

  await ensureOrderCourierSchema();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const channel = searchParams.get("channel");
  const paymentStatus = searchParams.get("paymentStatus");

  const data = await query(
    `select o.id, o.order_number, o.customer_id, o.status, o.payment_status, o.subtotal,
            coalesce(o.discount_amount, 0) as discount_amount,
            o.tax_amount, o.shipping_amount, o.total_amount,
            coalesce(o.channel, 'online') as channel, o.created_at,
            o.courier_name, o.courier_awb, o.courier_note,
            coalesce(nullif(o.pos_customer_name, ''), c.full_name) as customer_name,
            coalesce(nullif(o.pos_customer_email, ''), c.email) as customer_email,
            coalesce(nullif(o.pos_customer_phone, ''), c.phone) as customer_phone
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
    courier_name?: string | null;
    courier_awb?: string | null;
    courier_note?: string | null;
  } | null;

  if (!body?.orderId) return fail("orderId is required");

  await ensureOrderCourierSchema();

  const hasStatus = body.status != null && String(body.status).trim() !== "";
  const hasCourier =
    "courier_name" in body || "courier_awb" in body || "courier_note" in body;

  if (!hasStatus && !hasCourier) {
    return fail("Provide status and/or courier details");
  }

  if (hasStatus) {
    const nextStatus = String(body.status).toLowerCase().trim();
    if (!isOrderStatus(nextStatus)) {
      return fail(`Invalid order status: ${body.status}`, 400);
    }

    const wantsFulfillment = FULFILLMENT_STATUSES.has(nextStatus);
    const { error, ctx } = wantsFulfillment
      ? await requireAnyPermission(request, ["orders:fulfill", "orders:manage"])
      : await requirePermission(request, "orders:manage");

    if (error || !ctx) return error;

    const before = await queryOne<{ id: string; status: string }>(
      `select id, status from orders where id = $1`,
      [body.orderId]
    );
    if (!before) return fail("Order not found", 404);

    const fromStatus = String(before.status || "").toLowerCase();
    if (!isAllowedOrderTransition(fromStatus, nextStatus)) {
      return fail(
        `Invalid status transition: ${orderStatusLabel(fromStatus)} → ${orderStatusLabel(nextStatus)}`,
        400
      );
    }

    const data = await queryOne(
      `update orders
       set status = $2,
           courier_name = coalesce($3, courier_name),
           courier_awb = coalesce($4, courier_awb),
           courier_note = coalesce($5, courier_note)
       where id = $1
       returning *`,
      [
        body.orderId,
        nextStatus,
        body.courier_name !== undefined ? body.courier_name : null,
        body.courier_awb !== undefined ? body.courier_awb : null,
        body.courier_note !== undefined ? body.courier_note : null
      ]
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

  const { error, ctx } = await requireAnyPermission(request, [
    "orders:fulfill",
    "orders:manage"
  ]);
  if (error || !ctx) return error;

  const before = await queryOne(`select * from orders where id = $1`, [body.orderId]);
  if (!before) return fail("Order not found", 404);

  const data = await queryOne(
    `update orders
     set courier_name = coalesce($2, courier_name),
         courier_awb = coalesce($3, courier_awb),
         courier_note = coalesce($4, courier_note)
     where id = $1
     returning *`,
    [
      body.orderId,
      body.courier_name !== undefined ? body.courier_name : null,
      body.courier_awb !== undefined ? body.courier_awb : null,
      body.courier_note !== undefined ? body.courier_note : null
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update_courier",
    entityType: "orders",
    entityId: body.orderId,
    before,
    after: data
  });

  return ok(data);
}
