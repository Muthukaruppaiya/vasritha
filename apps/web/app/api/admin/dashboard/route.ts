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

  const [
    productsCount,
    ordersCount,
    usersCount,
    recentOrders,
    paidOrders,
    lowStock,
    periodComparison,
    salesTrendRows,
    statusBreakdown,
    categoryComposition,
    recentActivity
  ] = await Promise.all([
    queryOne<{ count: string }>(`select count(*)::text as count from products`),
    queryOne<{ count: string }>(`select count(*)::text as count from orders`),
    queryOne<{ count: string }>(`select count(*)::text as count from users`),
    query(
      `select id, order_number, status, payment_status, total_amount, created_at
       from orders
       order by created_at desc
       limit 8`
    ),
    query<{ total_amount: string }>(
      `select total_amount from orders where payment_status = 'paid'`
    ),
    queryOne<{ count: string }>(
      `select count(*)::text as count
       from products
       where status::text = 'active' and stock_quantity <= 5`
    ),
    queryOne<{
      sales_last7: string;
      sales_prev7: string;
      orders_last7: string;
      orders_prev7: string;
    }>(
      `select
         coalesce(sum(total_amount) filter (
           where payment_status = 'paid' and created_at >= now() - interval '7 days'
         ), 0)::text as sales_last7,
         coalesce(sum(total_amount) filter (
           where payment_status = 'paid'
             and created_at >= now() - interval '14 days'
             and created_at < now() - interval '7 days'
         ), 0)::text as sales_prev7,
         count(*) filter (where created_at >= now() - interval '7 days')::text as orders_last7,
         count(*) filter (
           where created_at >= now() - interval '14 days'
             and created_at < now() - interval '7 days'
         )::text as orders_prev7
       from orders`
    ),
    query<{ day: string; total: string }>(
      `select date_trunc('day', created_at)::text as day, coalesce(sum(total_amount), 0)::text as total
       from orders
       where payment_status = 'paid' and created_at >= now() - interval '7 days'
       group by day
       order by day asc`
    ),
    query<{ status: string; count: string }>(
      `select status::text as status, count(*)::text as count
       from orders
       group by status
       order by count desc`
    ),
    query<{ category: string; product_count: string }>(
      `select c.name as category, count(p.id)::text as product_count
       from categories c
       left join products p on p.category_id = c.id and p.status::text = 'active'
       group by c.name
       order by product_count desc, c.name asc
       limit 6`
    ),
    query<{
      id: string;
      action: string;
      entity_type: string;
      created_at: string;
      actor_name: string | null;
    }>(
      `select a.id, a.action, a.entity_type, a.created_at, u.full_name as actor_name
       from audit_logs a
       left join users u on u.id = a.actor_user_id
       order by a.created_at desc
       limit 6`
    )
  ]);

  const salesTotal = paidOrders.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);

  const salesLast7 = Number(periodComparison?.sales_last7 ?? 0);
  const salesPrev7 = Number(periodComparison?.sales_prev7 ?? 0);
  const ordersLast7 = Number(periodComparison?.orders_last7 ?? 0);
  const ordersPrev7 = Number(periodComparison?.orders_prev7 ?? 0);

  const pctChange = (current: number, previous: number) => {
    if (previous <= 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const salesByDay = new Map(
    salesTrendRows.map((row) => [row.day.slice(0, 10), Number(row.total)])
  );
  const trend: Array<{ date: string; label: string; total: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    trend.push({
      date: key,
      label: d.toLocaleDateString("en-IN", { weekday: "short" }),
      total: salesByDay.get(key) ?? 0
    });
  }

  return ok({
    summary: {
      products: Number(productsCount?.count ?? 0),
      orders: Number(ordersCount?.count ?? 0),
      users: Number(usersCount?.count ?? 0),
      customers: Number(usersCount?.count ?? 0),
      lowStock: Number(lowStock?.count ?? 0),
      salesTotal
    },
    trends: {
      salesChangePct: pctChange(salesLast7, salesPrev7),
      ordersChangePct: pctChange(ordersLast7, ordersPrev7)
    },
    salesTrend: trend,
    statusBreakdown: statusBreakdown.map((row) => ({
      status: row.status,
      count: Number(row.count)
    })),
    categoryComposition: categoryComposition.map((row) => ({
      category: row.category,
      count: Number(row.product_count)
    })),
    recentActivity: recentActivity.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      actorName: row.actor_name,
      createdAt: row.created_at
    })),
    recentOrders
  });
}
