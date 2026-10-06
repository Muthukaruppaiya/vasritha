import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne, withTransaction } from "../../../../../lib/db/pool";
import { earnLoyaltyForPaidOrder } from "../../../../../lib/loyalty";
import { requireScopedShopId } from "../../../../../lib/shop-scope";

type CollectBody = {
  orderId?: string;
  amount?: number;
  method?: "cash" | "upi" | "card";
  shopId?: string | null;
  note?: string | null;
};

/** Collect remaining balance on a POS credit / partial-pay bill. */
export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "pos:create");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as CollectBody | null;
  const orderId = String(body?.orderId || "").trim();
  const amount = Math.round(Math.max(0, Number(body?.amount) || 0) * 100) / 100;
  const method =
    body?.method === "upi" ? "upi" : body?.method === "card" ? "card" : "cash";

  if (!orderId) return fail("Order id required", 400);
  if (amount <= 0) return fail("Enter amount to collect", 400);

  try {
    if (body?.shopId) {
      await requireScopedShopId(ctx, String(body.shopId));
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Shop not allowed", 403);
  }

  const order = await queryOne<{
    id: string;
    order_number: string;
    total_amount: string;
    payment_status: string;
    status: string;
    channel: string | null;
    shop_id: string | null;
    pos_customer_name: string | null;
    pos_customer_phone: string | null;
  }>(
    `select id, order_number, total_amount, payment_status, status::text as status,
            channel, shop_id, pos_customer_name, pos_customer_phone
     from orders where id = $1`,
    [orderId]
  );

  if (!order) return fail("Bill not found", 404);
  if (order.channel !== "pos") return fail("Only store bills can be collected here", 400);
  if (order.status === "cancelled") return fail("Bill is cancelled", 400);
  if (order.payment_status === "paid") return fail("Bill is already fully paid", 400);

  const paidRow = await queryOne<{ paid: string }>(
    `select coalesce(sum(amount), 0)::text as paid
     from payments where order_id = $1 and status = 'paid'`,
    [orderId]
  );
  const total = Number(order.total_amount);
  const alreadyPaid = Number(paidRow?.paid || 0);
  const outstanding = Math.round(Math.max(0, total - alreadyPaid) * 100) / 100;
  if (outstanding <= 0) {
    await query(`update orders set payment_status = 'paid', status = 'confirmed' where id = $1`, [
      orderId
    ]);
    return fail("Bill is already fully paid", 400);
  }
  if (amount > outstanding + 0.009) {
    return fail(`Amount exceeds balance due (${outstanding.toFixed(2)})`, 400);
  }

  const collectAmount = Math.min(amount, outstanding);
  const provider =
    method === "upi" ? "upi" : method === "card" ? "card" : "cash";

  const result = await withTransaction(async (db) => {
    await db.query(
      `insert into payments (order_id, provider, provider_payment_id, amount, status)
       values ($1, $2, $3, $4, 'paid')`,
      [orderId, provider, `collect_${Date.now()}`, collectAmount]
    );

    const afterPaid = await db.queryOne<{ paid: string }>(
      `select coalesce(sum(amount), 0)::text as paid
       from payments where order_id = $1 and status = 'paid'`,
      [orderId]
    );
    const paidSum = Number(afterPaid?.paid || 0);
    const fullyPaid = paidSum + 0.001 >= total;
    if (fullyPaid) {
      await db.query(
        `update orders set payment_status = 'paid', status = 'confirmed' where id = $1`,
        [orderId]
      );
    }

    return {
      paid_amount: Math.round(paidSum * 100) / 100,
      balance_due: Math.round(Math.max(0, total - paidSum) * 100) / 100,
      fully_paid: fullyPaid
    };
  });

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "pos_collect",
    entityType: "orders",
    entityId: orderId,
    after: {
      amount: collectAmount,
      method,
      note: body?.note || null,
      ...result
    }
  });

  let loyalty: Awaited<ReturnType<typeof earnLoyaltyForPaidOrder>> = null;
  if (result.fully_paid) {
    loyalty = await earnLoyaltyForPaidOrder(orderId);
  }

  try {
    const { syncOrderPaymentsIntoFinance } = await import("../../../../../lib/finance");
    await syncOrderPaymentsIntoFinance(20);
  } catch {
    /* best-effort */
  }

  return ok({
    order_id: orderId,
    order_number: order.order_number,
    customer_name: order.pos_customer_name,
    customer_phone: order.pos_customer_phone,
    invoice_amount: total,
    collected: collectAmount,
    ...result,
    loyalty
  });
}
