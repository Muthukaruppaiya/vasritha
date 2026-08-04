import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error, ctx } = await requireAnyPermission(request, [
    "returns:handle",
    "returns:initiate",
    "orders:view"
  ]);
  if (error || !ctx) return error;

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

  const body = (await request.json().catch(() => null)) as {
    orderId?: string;
    reason?: string;
    items?: Array<{ orderItemId: string; quantity: number; reason?: string }>;
  } | null;

  if (!body?.orderId || !body.items?.length) return fail("orderId and items are required");

  const order = await queryOne<{ id: string; customer_id: string }>(
    `select * from orders where id = $1`,
    [body.orderId]
  );
  if (!order) return fail("Order not found", 404);

  const isStaff = ctx.roles.some((r) => r !== "customer");
  if (!isStaff && order.customer_id !== ctx.userId) return fail("Forbidden", 403);

  const returnNumber = `RET-${Date.now().toString().slice(-8)}`;
  const ret = await queryOne<{ id: string }>(
    `insert into order_returns (order_id, return_number, status, reason)
     values ($1, $2, 'requested', $3)
     returning *`,
    [order.id, returnNumber, body.reason ?? null]
  );
  if (!ret) return fail("Failed to create return", 400);

  for (const item of body.items) {
    await query(
      `insert into return_items (return_id, order_item_id, quantity, reason)
       values ($1, $2, $3, $4)`,
      [ret.id, item.orderItemId, item.quantity, item.reason ?? null]
    );
  }

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "return_requested",
    entityType: "order_returns",
    entityId: ret.id,
    after: ret
  });

  return ok(ret, 201);
}

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await requireAnyPermission(request, ["returns:handle", "refunds:approve"]);
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    returnId?: string;
    status?: "approved" | "rejected" | "received" | "refunded";
    refundAmount?: number;
  } | null;

  if (!body?.returnId || !body?.status) return fail("returnId and status are required");

  if (body.status === "refunded") {
    const refundAuth = await requirePermission(request, "refunds:approve");
    if (refundAuth.error) return refundAuth.error;
  }

  const before = await queryOne<{ refund_amount: string }>(
    `select * from order_returns where id = $1`,
    [body.returnId]
  );
  if (!before) return fail("Return not found", 404);

  const data = await queryOne(
    `update order_returns
     set status = $2, refund_amount = $3, updated_at = now()
     where id = $1
     returning *`,
    [body.returnId, body.status, body.refundAmount ?? before.refund_amount ?? 0]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "return_status",
    entityType: "order_returns",
    entityId: body.returnId,
    before,
    after: data
  });

  return ok(data);
}
