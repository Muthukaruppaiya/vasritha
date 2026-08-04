import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { queryOne } from "../../../../lib/db/pool";

type Order = { id: string; order_number: string; total_amount: string; payment_status: string };

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "checkout:own");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    orderId?: string;
    method?: "upi" | "card" | "netbanking";
  } | null;

  if (!body?.orderId) return fail("orderId is required");

  const order = await queryOne<Order>(
    `select * from orders where id = $1 and customer_id = $2`,
    [body.orderId, ctx.userId]
  );

  if (!order) return fail("Order not found", 404);
  if (order.payment_status === "paid") return fail("Order already paid");

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  // Demo / test mode when Razorpay keys are not configured
  if (!keyId || !keySecret) {
    const providerOrderId = `order_test_${Date.now()}`;
    const payment = await queryOne<{ id: string }>(
      `insert into payments (order_id, provider, provider_payment_id, amount, status)
       values ($1, 'razorpay_test', null, $2, 'pending')
       returning *`,
      [order.id, order.total_amount]
    );

    if (!payment) return fail("Payment create failed", 400);

    return ok({
      mode: "test",
      orderId: order.id,
      amount: order.total_amount,
      currency: "INR",
      razorpayOrderId: providerOrderId,
      paymentId: payment.id,
      keyId: null,
      note: "RAZORPAY keys missing — use /api/payments/verify in test mode"
    });
  }

  const amountPaise = Math.round(Number(order.total_amount) * 100);
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const razorpayRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: order.order_number,
      notes: { order_id: order.id, method: body.method ?? "upi" }
    })
  });

  const razorpayOrder = (await razorpayRes.json()) as { id?: string; error?: { description?: string } };
  if (!razorpayRes.ok || !razorpayOrder.id) {
    return fail(razorpayOrder.error?.description ?? "Razorpay order create failed", 502);
  }

  const payment = await queryOne<{ id: string }>(
    `insert into payments (order_id, provider, provider_payment_id, amount, status)
     values ($1, 'razorpay', null, $2, 'pending')
     returning *`,
    [order.id, order.total_amount]
  );

  if (!payment) return fail("Payment create failed", 400);

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "payment_create",
    entityType: "payments",
    entityId: payment.id,
    after: { razorpayOrderId: razorpayOrder.id }
  });

  return ok({
    mode: "live",
    orderId: order.id,
    amount: order.total_amount,
    currency: "INR",
    razorpayOrderId: razorpayOrder.id,
    paymentId: payment.id,
    keyId
  });
}
