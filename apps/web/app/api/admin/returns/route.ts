import { NextRequest } from "next/server";
import {
  fail,
  ok,
  requireAnyPermission,
  requirePermission,
  writeAuditLog
} from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";
import {
  ensureExchangePolicySchema,
  evaluateExchangeEligibility,
  getExchangePolicySettings,
  isAllowedExchangeTransition
} from "../../../../lib/exchange-policy";

async function restockReturnItems(returnId: string, actorUserId: string) {
  const lines = await query<{
    quantity: number;
    variant_id: string | null;
    product_name: string;
  }>(
    `select ri.quantity, oi.variant_id, oi.product_name
     from return_items ri
     join order_items oi on oi.id = ri.order_item_id
     where ri.return_id = $1`,
    [returnId]
  );

  for (const line of lines) {
    if (!line.variant_id) continue;
    const qty = Math.max(1, Number(line.quantity) || 1);
    await query(
      `update product_variants
       set stock_quantity = stock_quantity + $2
       where id = $1`,
      [line.variant_id, qty]
    );
    await query(
      `update products p
       set stock_quantity = coalesce((
         select sum(pv.stock_quantity)::int from product_variants pv where pv.product_id = p.id
       ), 0),
       updated_at = now()
       where id = (select product_id from product_variants where id = $1)`,
      [line.variant_id]
    );
    await query(
      `insert into inventory_movements
         (product_variant_id, type, quantity, reference_type, reference_id, note, created_by)
       values ($1, 'return', $2, 'exchange', $3, $4, $5)`,
      [
        line.variant_id,
        qty,
        returnId,
        `Exchange receive · ${line.product_name}`,
        actorUserId
      ]
    ).catch(() => undefined);
  }
}

export async function GET(request: NextRequest) {
  const { error, ctx } = await requireAnyPermission(request, [
    "returns:handle",
    "returns:initiate",
    "orders:view"
  ]);
  if (error || !ctx) return error;

  await ensureExchangePolicySchema();
  const isCustomerOnly = ctx.roles.length === 1 && ctx.roles[0] === "customer";

  const returns = await query<{ id: string; order_id: string }>(
    `select r.*
     from order_returns r
     ${isCustomerOnly ? "join orders o on o.id = r.order_id" : ""}
     ${isCustomerOnly ? "where o.customer_id = $1" : ""}
     order by r.created_at desc`,
    isCustomerOnly ? [ctx.userId] : []
  );

  const returnIds = returns.map((r) => r.id);
  const orderIds = returns.map((r) => r.order_id);

  const [items, orders] = await Promise.all([
    returnIds.length
      ? query(`select * from return_items where return_id = any($1::uuid[])`, [returnIds])
      : Promise.resolve([]),
    orderIds.length
      ? query<{ id: string; order_number: string; customer_id: string; total_amount: string }>(
          `select id, order_number, customer_id, total_amount from orders where id = any($1::uuid[])`,
          [orderIds]
        )
      : Promise.resolve([])
  ]);

  const data = returns.map((ret) => ({
    ...ret,
    return_items: items.filter((item) => (item as { return_id: string }).return_id === ret.id),
    orders: orders.find((o) => o.id === ret.order_id) ?? null
  }));

  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "returns:initiate");
  if (error || !ctx) return error;

  await ensureExchangePolicySchema();
  const settings = await getExchangePolicySettings();

  if (!settings.exchange_enabled) {
    return fail("Exchanges are temporarily unavailable", 400);
  }

  const body = (await request.json().catch(() => null)) as {
    orderId?: string;
    reason?: string;
    items?: Array<{ orderItemId: string; quantity: number; reason?: string }>;
  } | null;

  if (!body?.orderId || !body.items?.length) return fail("orderId and items are required");

  const order = await queryOne<{
    id: string;
    customer_id: string;
    total_amount: string;
    status: string;
    payment_status: string;
    created_at: string;
    updated_at: string;
  }>(
    `select id, customer_id, total_amount, status, payment_status, created_at, updated_at
     from orders where id = $1`,
    [body.orderId]
  );
  if (!order) return fail("Order not found", 404);

  const isStaff = ctx.roles.some((r) => r !== "customer");
  if (!isStaff && order.customer_id !== ctx.userId) return fail("Forbidden", 403);

  const eligibility = evaluateExchangeEligibility({ order, settings });
  if (!eligibility.eligible && !isStaff) {
    return fail(eligibility.reason, 400);
  }

  const orderItems = await query<{ id: string; quantity: number }>(
    `select id, quantity from order_items where order_id = $1`,
    [order.id]
  );
  const byId = new Map(orderItems.map((row) => [row.id, row]));

  for (const item of body.items) {
    const line = byId.get(item.orderItemId);
    if (!line) return fail(`Order item not found on this order: ${item.orderItemId}`, 400);
    const qty = Math.max(1, Number(item.quantity) || 0);
    if (qty > Number(line.quantity)) {
      return fail(`Exchange quantity exceeds sold quantity for item ${item.orderItemId}`, 400);
    }

    const already = await queryOne<{ returned: string }>(
      `select coalesce(sum(ri.quantity), 0)::text as returned
       from return_items ri
       join order_returns r on r.id = ri.return_id
       where ri.order_item_id = $1
         and r.status <> 'rejected'`,
      [item.orderItemId]
    );
    const returnedSoFar = Number(already?.returned || 0);
    if (returnedSoFar + qty > Number(line.quantity)) {
      return fail(
        `Exchange quantity exceeds remaining exchangeable qty for item ${item.orderItemId}`,
        400
      );
    }
  }

  const returnNumber = `EXC-${Date.now().toString().slice(-8)}`;
  const ret = await queryOne<{ id: string }>(
    `insert into order_returns (order_id, return_number, status, reason, request_type, refund_amount)
     values ($1, $2, 'requested', $3, 'exchange', 0)
     returning *`,
    [order.id, returnNumber, body.reason ?? null]
  );
  if (!ret) return fail("Failed to create exchange request", 400);

  for (const item of body.items) {
    await query(
      `insert into return_items (return_id, order_item_id, quantity, reason)
       values ($1, $2, $3, $4)`,
      [ret.id, item.orderItemId, Math.max(1, Number(item.quantity) || 1), item.reason ?? null]
    );
  }

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "exchange_requested",
    entityType: "order_returns",
    entityId: ret.id,
    after: ret
  });

  return ok(ret, 201);
}

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await requireAnyPermission(request, ["returns:handle", "refunds:approve"]);
  if (error || !ctx) return error;

  await ensureExchangePolicySchema();
  const settings = await getExchangePolicySettings();

  const body = (await request.json().catch(() => null)) as {
    returnId?: string;
    status?: string;
    refundAmount?: number;
    adminNotes?: string;
  } | null;

  if (!body?.returnId || !body?.status) return fail("returnId and status are required");

  const before = await queryOne<{
    id: string;
    order_id: string;
    refund_amount: string;
    status: string;
    request_type: string | null;
  }>(`select * from order_returns where id = $1`, [body.returnId]);
  if (!before) return fail("Exchange request not found", 404);

  // NO REFUND — backend hard block
  if (settings.no_refund_policy) {
    if (body.status === "refunded") {
      return fail(
        "This boutique follows a NO REFUND policy. Mark the exchange as completed instead.",
        400
      );
    }
    if (body.refundAmount != null && Number(body.refundAmount) > 0) {
      return fail("Refunds are not permitted under the store exchange policy", 400);
    }
  }

  if (!isAllowedExchangeTransition(before.status, body.status) && body.status !== before.status) {
    // Allow staff to set exchanged from received; reject illegal jumps
    if (!(before.status === "received" && body.status === "exchanged")) {
      if (!["approved", "rejected", "received", "exchanged"].includes(body.status)) {
        return fail(`Invalid status transition: ${before.status} → ${body.status}`, 400);
      }
      if (!isAllowedExchangeTransition(before.status, body.status)) {
        return fail(`Invalid status transition: ${before.status} → ${body.status}`, 400);
      }
    }
  }

  const data = await queryOne(
    `update order_returns
     set status = $2,
         refund_amount = 0,
         admin_notes = coalesce($3, admin_notes),
         request_type = coalesce(nullif(request_type,''), 'exchange'),
         updated_at = now()
     where id = $1
     returning *`,
    [body.returnId, body.status, body.adminNotes ?? null]
  );

  // Restock once when goods are received for exchange
  if (before.status !== "received" && body.status === "received") {
    await restockReturnItems(body.returnId, ctx.userId);
  }

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "exchange_status",
    entityType: "order_returns",
    entityId: body.returnId,
    before,
    after: data
  });

  return ok(data);
}
