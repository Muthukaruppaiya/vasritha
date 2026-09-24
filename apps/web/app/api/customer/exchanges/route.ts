import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";
import {
  buildPurchasePolicySummary,
  ensureExchangePolicySchema,
  evaluateExchangeEligibility,
  getExchangePolicySettings
} from "../../../../lib/exchange-policy";

export async function GET(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "returns:initiate");
  if (error || !ctx) return error;

  await ensureExchangePolicySchema();
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");

  if (orderId) {
    const order = await queryOne<{
      id: string;
      status: string;
      payment_status: string;
      created_at: string;
      updated_at: string;
    }>(
      `select id, status, payment_status, created_at, updated_at
       from orders where id = $1 and customer_id = $2`,
      [orderId, ctx.userId]
    );
    if (!order) return fail("Order not found", 404);
    const settings = await getExchangePolicySettings();
    const eligibility = evaluateExchangeEligibility({ order, settings });
    const exchanges = await query(
      `select id, return_number, status, reason, request_type, created_at, updated_at
       from order_returns
       where order_id = $1
       order by created_at desc`,
      [orderId]
    );
    return ok({
      settings,
      summary: buildPurchasePolicySummary(settings),
      eligibility,
      order,
      exchanges
    });
  }

  const rows = await query(
    `select r.id, r.return_number, r.status, r.reason, r.created_at, r.request_type,
            o.order_number
     from order_returns r
     join orders o on o.id = r.order_id
     where o.customer_id = $1
     order by r.created_at desc`,
    [ctx.userId]
  );
  return ok(rows);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "returns:initiate");
  if (error || !ctx) return error;

  await ensureExchangePolicySchema();
  const settings = await getExchangePolicySettings();
  if (!settings.exchange_enabled) return fail("Exchanges are temporarily unavailable", 400);

  const body = (await request.json().catch(() => null)) as {
    orderId?: string;
    reason?: string;
    requestType?: string;
    items?: Array<{ orderItemId: string; quantity: number; reason?: string }>;
  } | null;

  if (settings.no_refund_policy && body?.requestType === "refund") {
    return fail("This boutique follows a NO REFUND policy. Exchanges only.", 400);
  }

  if (!body?.orderId || !body.items?.length) return fail("orderId and items are required");

  const order = await queryOne<{
    id: string;
    customer_id: string;
    status: string;
    payment_status: string;
    created_at: string;
    updated_at: string;
  }>(
    `select id, customer_id, status, payment_status, created_at, updated_at
     from orders where id = $1 and customer_id = $2`,
    [body.orderId, ctx.userId]
  );
  if (!order) return fail("Order not found", 404);

  const eligibility = evaluateExchangeEligibility({ order, settings });
  if (!eligibility.eligible) return fail(eligibility.reason, 400);

  const orderItems = await query<{ id: string; quantity: number }>(
    `select id, quantity from order_items where order_id = $1`,
    [order.id]
  );
  const byId = new Map(orderItems.map((row) => [row.id, row]));

  for (const item of body.items) {
    const line = byId.get(item.orderItemId);
    if (!line) return fail(`Order item not found: ${item.orderItemId}`, 400);
    const qty = Math.max(1, Number(item.quantity) || 0);
    if (qty > Number(line.quantity)) {
      return fail("Exchange quantity exceeds purchased quantity", 400);
    }
    const already = await queryOne<{ returned: string }>(
      `select coalesce(sum(ri.quantity), 0)::text as returned
       from return_items ri
       join order_returns r on r.id = ri.return_id
       where ri.order_item_id = $1 and r.status <> 'rejected'`,
      [item.orderItemId]
    );
    if (Number(already?.returned || 0) + qty > Number(line.quantity)) {
      return fail("Exchange quantity exceeds remaining exchangeable quantity", 400);
    }
  }

  const returnNumber = `EXC-${Date.now().toString().slice(-8)}`;
  const ret = await queryOne(
    `insert into order_returns (order_id, return_number, status, reason, request_type, refund_amount)
     values ($1, $2, 'requested', $3, 'exchange', 0)
     returning *`,
    [order.id, returnNumber, body.reason?.trim() || null]
  );
  if (!ret) return fail("Could not create exchange request", 400);

  for (const item of body.items) {
    await query(
      `insert into return_items (return_id, order_item_id, quantity, reason)
       values ($1, $2, $3, $4)`,
      [
        (ret as { id: string }).id,
        item.orderItemId,
        Math.max(1, Number(item.quantity) || 1),
        item.reason ?? null
      ]
    );
  }

  return ok(ret, 201);
}
