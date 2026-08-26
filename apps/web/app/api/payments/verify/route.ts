import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne, withTransaction } from "../../../../lib/db/pool";
import { isTestPaymentProvider, verifyRazorpayHmac } from "../../../../lib/payment-verify";

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

  const order = await queryOne<{ id: string; payment_status: string }>(
    `select id, payment_status from orders where id = $1 and customer_id = $2`,
    [body.orderId, ctx.userId]
  );
  if (!order) return fail("Order not found", 404);

  if (order.payment_status === "paid") {
    return ok({
      orderId: order.id,
      paymentStatus: "paid",
      orderStatus: "confirmed"
    });
  }

  const payment = await queryOne<{
    id: string;
    order_id: string;
    provider: string;
    status: string;
    amount: string;
  }>(`select id, order_id, provider, status, amount from payments where id = $1 and order_id = $2`, [
    body.paymentId,
    order.id
  ]);
  if (!payment) return fail("Payment not found for this order", 404);

  if (payment.status === "paid") {
    await query(`update orders set payment_status = 'paid', status = 'confirmed' where id = $1`, [
      order.id
    ]);
    return ok({
      orderId: order.id,
      paymentStatus: "paid",
      orderStatus: "confirmed"
    });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  let verified = false;

  if (isTestPaymentProvider(payment.provider)) {
    // Demo path: only payments created without Razorpay keys
    verified = body.testSuccess !== false;
  } else if (keySecret) {
    if (!body.razorpayOrderId || !body.razorpayPaymentId || !body.razorpaySignature) {
      return fail("Razorpay verification fields are required");
    }
    verified = verifyRazorpayHmac({
      keySecret,
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature
    });
  } else {
    return fail("Payment provider is not configured for live verification", 400);
  }

  if (!verified) {
    await query(`update payments set status = 'failed' where id = $1 and order_id = $2`, [
      payment.id,
      order.id
    ]);
    return fail("Payment verification failed", 400);
  }

  try {
    const result = await withTransaction(async (db) => {
      const locked = await db.queryOne<{ id: string; payment_status: string }>(
        `select id, payment_status from orders where id = $1 for update`,
        [order.id]
      );
      if (!locked) throw new Error("Order not found");
      if (locked.payment_status === "paid") {
        return { alreadyPaid: true as const };
      }

      const paidPayment = await db.queryOne(
        `update payments
         set status = 'paid', provider_payment_id = $3
         where id = $1 and order_id = $2 and status <> 'paid'
         returning *`,
        [
          payment.id,
          order.id,
          body.razorpayPaymentId ?? `pay_test_${Date.now()}`
        ]
      );
      if (!paidPayment) throw new Error("Payment update failed");

      await db.query(
        `update orders set payment_status = 'paid', status = 'confirmed' where id = $1`,
        [order.id]
      );

      const items = await db.query<{
        variant_id: string | null;
        product_id: string | null;
        quantity: number;
      }>(`select variant_id, product_id, quantity from order_items where order_id = $1`, [order.id]);

      for (const item of items) {
        if (item.variant_id) {
          const updated = await db.queryOne<{ id: string }>(
            `update product_variants
             set stock_quantity = stock_quantity - $2
             where id = $1 and stock_quantity >= $2
             returning id`,
            [item.variant_id, item.quantity]
          );
          if (!updated) {
            throw new Error("Insufficient stock to complete this order");
          }
          await db.query(
            `insert into inventory_movements (product_variant_id, type, quantity, reference_type, reference_id, created_by)
             values ($1, 'sale', $2, 'order', $3, $4)`,
            [item.variant_id, item.quantity, order.id, ctx.userId]
          );
        }
        if (item.product_id) {
          await db.query(
            `update products set stock_quantity = greatest(0, stock_quantity - $2) where id = $1`,
            [item.product_id, item.quantity]
          );
        }
      }

      return { alreadyPaid: false as const, payment: paidPayment };
    });

    if (result.alreadyPaid) {
      return ok({
        orderId: order.id,
        paymentStatus: "paid",
        orderStatus: "confirmed"
      });
    }

    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "payment_paid",
      entityType: "orders",
      entityId: order.id,
      after: result.payment
    });

    return ok({
      orderId: order.id,
      paymentStatus: "paid",
      orderStatus: "confirmed",
      payment: result.payment
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Payment verification failed", 400);
  }
}
