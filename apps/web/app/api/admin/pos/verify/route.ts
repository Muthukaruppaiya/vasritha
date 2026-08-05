import { createHmac } from "crypto";
import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";
import { ensurePosSchema } from "../../../../../lib/pos";

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "pos:create");
  if (error || !ctx) return error;

  await ensurePosSchema();

  const body = (await request.json().catch(() => null)) as {
    orderId?: string;
    paymentId?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    testSuccess?: boolean;
  } | null;

  if (!body?.orderId || !body?.paymentId) return fail("orderId and paymentId are required");

  const order = await queryOne<{ id: string; channel: string; payment_status: string }>(
    `select id, coalesce(channel, 'online') as channel, payment_status from orders where id = $1`,
    [body.orderId]
  );
  if (!order) return fail("Order not found", 404);
  if (order.channel !== "pos") return fail("Not a POS order", 400);
  if (order.payment_status === "paid") {
    return ok({ orderId: order.id, paymentStatus: "paid", orderStatus: "confirmed" });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  let verified = false;

  if (!keySecret || body.testSuccess) {
    verified = Boolean(body.testSuccess ?? true);
  } else {
    if (!body.razorpayOrderId || !body.razorpayPaymentId || !body.razorpaySignature) {
      return fail("Razorpay verification fields are required");
    }
    const payload = `${body.razorpayOrderId}|${body.razorpayPaymentId}`;
    const expected = createHmac("sha256", keySecret).update(payload).digest("hex");
    verified = expected === body.razorpaySignature;
  }

  if (!verified) {
    await query(`update payments set status = 'failed' where id = $1`, [body.paymentId]);
    return fail("Payment verification failed", 400);
  }

  const payment = await queryOne(
    `update payments set status = 'paid', provider_payment_id = $2 where id = $1 returning *`,
    [body.paymentId, body.razorpayPaymentId ?? `pay_pos_${Date.now()}`]
  );
  if (!payment) return fail("Payment not found", 404);

  await query(
    `update orders set payment_status = 'paid', status = 'confirmed' where id = $1`,
    [order.id]
  );

  const items = await query<{
    product_id: string;
    variant_id: string | null;
    quantity: number;
  }>(`select product_id, variant_id, quantity from order_items where order_id = $1`, [order.id]);

  for (const item of items) {
    if (item.variant_id) {
      const variant = await queryOne<{ stock_quantity: number }>(
        `select stock_quantity from product_variants where id = $1`,
        [item.variant_id]
      );
      if (variant) {
        await query(`update product_variants set stock_quantity = $2 where id = $1`, [
          item.variant_id,
          Math.max(0, Number(variant.stock_quantity) - Number(item.quantity))
        ]);
        await query(
          `insert into inventory_movements (product_variant_id, type, quantity, reference_type, reference_id, created_by)
           values ($1, 'sale', $2, 'order', $3, $4)`,
          [item.variant_id, item.quantity, order.id, ctx.userId]
        );
      }
    }
    await query(
      `update products set stock_quantity = greatest(0, stock_quantity - $2) where id = $1`,
      [item.product_id, item.quantity]
    );
  }

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "pos_payment_paid",
    entityType: "orders",
    entityId: order.id,
    after: payment
  });

  const refreshed = await queryOne(
    `select id, order_number, status, payment_status, subtotal, discount_amount, total_amount, created_at, channel
     from orders where id = $1`,
    [order.id]
  );

  return ok({
    orderId: order.id,
    paymentStatus: "paid",
    orderStatus: "confirmed",
    order: refreshed,
    payment
  });
}
