import { createHmac } from "crypto";
import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "checkout:own");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    orderId?: string;
    paymentId?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    testSuccess?: boolean;
  } | null;

  if (!body?.orderId || !body?.paymentId) return fail("orderId and paymentId are required");

  const order = await queryOne<{ id: string }>(
    `select * from orders where id = $1 and customer_id = $2`,
    [body.orderId, ctx.userId]
  );
  if (!order) return fail("Order not found", 404);

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
    [body.paymentId, body.razorpayPaymentId ?? `pay_test_${Date.now()}`]
  );

  if (!payment) return fail("Payment not found", 404);

  await query(
    `update orders set payment_status = 'paid', status = 'confirmed' where id = $1`,
    [order.id]
  );

  // inventory movements for sold variants
  const items = await query<{ variant_id: string | null; quantity: number }>(
    `select variant_id, quantity from order_items where order_id = $1`,
    [order.id]
  );

  for (const item of items) {
    if (!item.variant_id) continue;
    await query(
      `insert into inventory_movements (product_variant_id, type, quantity, reference_type, reference_id, created_by)
       values ($1, 'sale', $2, 'order', $3, $4)`,
      [item.variant_id, item.quantity, order.id, ctx.userId]
    );
    const variant = await queryOne<{ stock_quantity: number }>(
      `select stock_quantity from product_variants where id = $1`,
      [item.variant_id]
    );
    if (variant) {
      await query(`update product_variants set stock_quantity = $2 where id = $1`, [
        item.variant_id,
        Math.max(0, Number(variant.stock_quantity) - Number(item.quantity))
      ]);
    }
  }

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "payment_paid",
    entityType: "orders",
    entityId: order.id,
    after: payment
  });

  return ok({
    orderId: order.id,
    paymentStatus: "paid",
    orderStatus: "confirmed",
    payment
  });
}
