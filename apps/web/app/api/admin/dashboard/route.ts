import { NextRequest } from "next/server";
import { ok, requireAnyPermission } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "dashboard:all",
    "dashboard:ops",
    "dashboard:finance"
  ]);
  if (error) return error;

  const [productsCount, ordersCount, customersCount, recentOrders, paidOrders] = await Promise.all([
    queryOne<{ count: string }>(`select count(*)::text as count from products`),
    queryOne<{ count: string }>(`select count(*)::text as count from orders`),
    queryOne<{ count: string }>(`select count(*)::text as count from customers`),
    query(
      `select id, order_number, status, payment_status, total_amount, created_at
       from orders
       order by created_at desc
       limit 8`
    ),
    query<{ total_amount: string }>(
      `select total_amount from orders where payment_status = 'paid'`
    )
  ]);

  const salesTotal = paidOrders.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);

  return ok({
    summary: {
      products: Number(productsCount?.count ?? 0),
      orders: Number(ordersCount?.count ?? 0),
      customers: Number(customersCount?.count ?? 0),
      salesTotal
    },
    recentOrders
  });
}
