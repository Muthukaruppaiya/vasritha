import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";
import { resolveFinancePeriod, type FinancePeriodKey } from "../../../../lib/finance-period";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function dateClause(column: string, fromParam: number, toParam: number) {
  return `${column}::date between $${fromParam}::date and $${toParam}::date`;
}

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "dashboard:all",
    "dashboard:ops",
    "dashboard:finance"
  ]);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const periodKey = (searchParams.get("period") || "this_month") as FinancePeriodKey;
    const range = resolveFinancePeriod(periodKey, {
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined
    });
    const today = resolveFinancePeriod("today");
    const week = resolveFinancePeriod("this_week");
    const month = resolveFinancePeriod("this_month");

    // Do NOT sync finance here — that was making every dashboard open very slow.
    // Sync runs from Finance → Sync button / finance sync API only.

    const from = range.from;
    const to = range.to;

    const [
      salesSnapshot,
      orderCounts,
      paymentMix,
      refunds,
      purchaseSnap,
      expenseSnap,
      expenseByCategory,
      inventory,
      customers,
      suppliers,
      salesTrendRows,
      monthlyTrendRows,
      salesByCategory,
      statusBreakdown,
      recentOrders,
      recentPayments,
      recentPurchases,
      recentExpenses,
      recentReturns,
      recentActivity,
      periodCompare
    ] = await Promise.all([
      // Sales snapshot: today / week / month / period / all-time
      queryOne<{
        today: string;
        week: string;
        month: string;
        period: string;
        all_time: string;
        period_discount: string;
        period_order_count: string;
      }>(
        `select
           coalesce(sum(total_amount) filter (where payment_status = 'paid' and created_at::date = $1::date),0)::text as today,
           coalesce(sum(total_amount) filter (where payment_status = 'paid' and created_at::date between $2::date and $3::date),0)::text as week,
           coalesce(sum(total_amount) filter (where payment_status = 'paid' and created_at::date between $4::date and $5::date),0)::text as month,
           coalesce(sum(total_amount) filter (where payment_status = 'paid' and created_at::date between $6::date and $7::date),0)::text as period,
           coalesce(sum(total_amount) filter (where payment_status = 'paid'),0)::text as all_time,
           coalesce(sum(discount_amount) filter (where payment_status = 'paid' and created_at::date between $6::date and $7::date),0)::text as period_discount,
           count(*) filter (where created_at::date between $6::date and $7::date)::text as period_order_count
         from orders`,
        [today.from, week.from, week.to, month.from, month.to, from, to]
      ),

      queryOne<{
        total: string;
        paid: string;
        pending: string;
        cancelled: string;
        returned: string;
      }>(
        `select
           count(*) filter (where ${dateClause("created_at", 1, 2)})::text as total,
           count(*) filter (where payment_status = 'paid' and ${dateClause("created_at", 1, 2)})::text as paid,
           count(*) filter (where payment_status = 'pending' and coalesce(status::text,'') <> 'cancelled' and ${dateClause("created_at", 1, 2)})::text as pending,
           count(*) filter (where status::text = 'cancelled' and ${dateClause("created_at", 1, 2)})::text as cancelled,
           (select count(*)::text from order_returns r where ${dateClause("r.created_at", 1, 2)}) as returned
         from orders`,
        [from, to]
      ),

      queryOne<{
        cash: string;
        upi: string;
        card: string;
        online: string;
        other: string;
        total_paid: string;
        pending_ar: string;
      }>(
        `select
           coalesce(sum(p.amount) filter (where p.status = 'paid' and lower(p.provider) in ('cash','pos_cash') and ${dateClause("p.created_at", 1, 2)}),0)::text as cash,
           coalesce(sum(p.amount) filter (where p.status = 'paid' and lower(p.provider) = 'upi' and ${dateClause("p.created_at", 1, 2)}),0)::text as upi,
           coalesce(sum(p.amount) filter (where p.status = 'paid' and lower(p.provider) = 'card' and ${dateClause("p.created_at", 1, 2)}),0)::text as card,
           coalesce(sum(p.amount) filter (where p.status = 'paid' and lower(p.provider) = 'razorpay' and ${dateClause("p.created_at", 1, 2)}),0)::text as online,
           coalesce(sum(p.amount) filter (where p.status = 'paid' and lower(p.provider) not in ('cash','pos_cash','upi','card','razorpay') and ${dateClause("p.created_at", 1, 2)}),0)::text as other,
           coalesce(sum(p.amount) filter (where p.status = 'paid' and ${dateClause("p.created_at", 1, 2)}),0)::text as total_paid,
           coalesce((select sum(o.total_amount) from orders o where o.payment_status = 'pending' and coalesce(o.status::text,'') <> 'cancelled'),0)::text as pending_ar
         from payments p`,
        [from, to]
      ),

      queryOne<{ refunded: string; return_count: string }>(
        `select
           coalesce(sum(refund_amount) filter (where status = 'refunded' and ${dateClause("coalesce(updated_at, created_at)", 1, 2)}),0)::text as refunded,
           count(*) filter (where ${dateClause("created_at", 1, 2)})::text as return_count
         from order_returns`,
        [from, to]
      ).catch(() => ({ refunded: "0", return_count: "0" })),

      queryOne<{
        period: string;
        today: string;
        month: string;
        pending: string;
      }>(
        `select
           coalesce(sum(amount) filter (where category = 'purchase' and status <> 'cancelled' and ${dateClause("entry_date", 1, 2)}),0)::text as period,
           coalesce(sum(amount) filter (where category = 'purchase' and status <> 'cancelled' and entry_date = $3::date),0)::text as today,
           coalesce(sum(amount) filter (where category = 'purchase' and status <> 'cancelled' and entry_date between $4::date and $5::date),0)::text as month,
           coalesce(sum(amount) filter (where category = 'purchase' and status = 'pending'),0)::text as pending
         from finance_payment_entries`,
        [from, to, today.from, month.from, month.to]
      ).catch(() => ({ period: "0", today: "0", month: "0", pending: "0" })),

      queryOne<{
        today: string;
        month: string;
        period: string;
        total: string;
      }>(
        `select
           coalesce(sum(amount) filter (where direction = 'out' and status = 'cleared' and category in ('expense','salary','rent','utilities','logistics','packaging','marketing','maintenance','tax','other') and entry_date = $1::date),0)::text as today,
           coalesce(sum(amount) filter (where direction = 'out' and status = 'cleared' and category in ('expense','salary','rent','utilities','logistics','packaging','marketing','maintenance','tax','other') and entry_date between $2::date and $3::date),0)::text as month,
           coalesce(sum(amount) filter (where direction = 'out' and status = 'cleared' and category in ('expense','salary','rent','utilities','logistics','packaging','marketing','maintenance','tax','other') and ${dateClause("entry_date", 4, 5)}),0)::text as period,
           coalesce(sum(amount) filter (where direction = 'out' and status = 'cleared' and category in ('expense','salary','rent','utilities','logistics','packaging','marketing','maintenance','tax','other')),0)::text as total
         from finance_payment_entries`,
        [today.from, month.from, month.to, from, to]
      ).catch(() => ({ today: "0", month: "0", period: "0", total: "0" })),

      query<{ category: string; total: string }>(
        `select category, coalesce(sum(amount),0)::text as total
         from finance_payment_entries
         where direction = 'out' and status = 'cleared'
           and category in ('expense','salary','rent','utilities','logistics','packaging','marketing','maintenance','tax','other')
           and ${dateClause("entry_date", 1, 2)}
         group by category
         order by sum(amount) desc
         limit 10`,
        [from, to]
      ).catch(() => []),

      queryOne<{
        total: string;
        active: string;
        low_stock: string;
        out_of_stock: string;
        pending_approval: string;
      }>(
        `select
           count(*)::text as total,
           count(*) filter (where status::text = 'active')::text as active,
           count(*) filter (where status::text = 'active' and stock_quantity > 0 and stock_quantity <= 5)::text as low_stock,
           count(*) filter (where status::text = 'active' and stock_quantity <= 0)::text as out_of_stock,
           count(*) filter (where status::text = 'pending_approval')::text as pending_approval
         from products`
      ),

      queryOne<{
        total: string;
        new_in_period: string;
        returning: string;
      }>(
        `select
           count(*)::text as total,
           count(*) filter (where ${dateClause("created_at", 1, 2)})::text as new_in_period,
           count(*) filter (
             where id in (
               select customer_id from orders
               where customer_id is not null
               group by customer_id
               having count(*) > 1
             )
           )::text as returning
         from customers`,
        [from, to]
      ).catch(() => ({ total: "0", new_in_period: "0", returning: "0" })),

      queryOne<{ total: string; active: string }>(
        `select count(*)::text as total,
                count(*) filter (where is_active = true)::text as active
         from suppliers`
      ).catch(() => ({ total: "0", active: "0" })),

      query<{ day: string; total: string }>(
        `select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
                coalesce(sum(total_amount),0)::text as total
         from orders
         where payment_status = 'paid' and ${dateClause("created_at", 1, 2)}
         group by date_trunc('day', created_at)
         order by date_trunc('day', created_at)`,
        [from, to]
      ),

      query<{ month: string; total: string }>(
        `select to_char(date_trunc('month', created_at), 'Mon YY') as month,
                coalesce(sum(total_amount),0)::text as total
         from orders
         where payment_status = 'paid'
           and created_at >= date_trunc('month', now()) - interval '5 months'
         group by date_trunc('month', created_at)
         order by date_trunc('month', created_at)`
      ),

      query<{ category: string; total: string }>(
        `select coalesce(c.name, 'Uncategorised') as category,
                coalesce(sum(oi.line_total),0)::text as total
         from order_items oi
         join orders o on o.id = oi.order_id
         left join products p on p.id = oi.product_id
         left join categories c on c.id = p.category_id
         where o.payment_status = 'paid' and ${dateClause("o.created_at", 1, 2)}
         group by coalesce(c.name, 'Uncategorised')
         order by sum(oi.line_total) desc
         limit 8`,
        [from, to]
      ).catch(() => []),

      query<{ status: string; count: string }>(
        `select status::text as status, count(*)::text as count
         from orders
         where ${dateClause("created_at", 1, 2)}
         group by status
         order by count desc`,
        [from, to]
      ),

      query(
        `select id, order_number, status, payment_status, total_amount, created_at, coalesce(channel,'online') as channel
         from orders
         order by created_at desc
         limit 8`
      ),

      query(
        `select p.id, p.amount, p.provider, p.status, p.created_at, o.order_number
         from payments p
         join orders o on o.id = p.order_id
         order by p.created_at desc
         limit 6`
      ),

      query(
        `select id, entry_no, amount, status, entry_date, counterparty_name, reference_no
         from finance_payment_entries
         where category = 'purchase' and status <> 'cancelled'
         order by entry_date desc, created_at desc
         limit 6`
      ).catch(() => []),

      query(
        `select id, entry_no, category, amount, entry_date, counterparty_name
         from finance_payment_entries
         where direction = 'out' and status = 'cleared'
           and category in ('expense','salary','rent','utilities','logistics','packaging','marketing','maintenance','tax','other')
         order by entry_date desc, created_at desc
         limit 6`
      ).catch(() => []),

      query(
        `select r.id, r.status, r.refund_amount, r.created_at, o.order_number
         from order_returns r
         join orders o on o.id = r.order_id
         order by r.created_at desc
         limit 6`
      ).catch(() => []),

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
         limit 8`
      ),

      queryOne<{ sales_prev: string; orders_prev: string }>(
        `with bounds as (
           select $1::date as from_d, $2::date as to_d,
                  ($2::date - $1::date) as span
         )
         select
           coalesce(sum(o.total_amount) filter (
             where o.payment_status = 'paid'
               and o.created_at::date between (b.from_d - b.span - 1) and (b.from_d - 1)
           ),0)::text as sales_prev,
           count(*) filter (
             where o.created_at::date between (b.from_d - b.span - 1) and (b.from_d - 1)
           )::text as orders_prev
         from bounds b
         left join orders o on true`,
        [from, to]
      ).catch(() => ({ sales_prev: "0", orders_prev: "0" }))
    ]);

    const salesPeriod = Number(salesSnapshot?.period || 0);
    const purchasesPeriod = Number(purchaseSnap?.period || 0);
    const expensesPeriod = Number(expenseSnap?.period || 0);
    const discountsPeriod = Number(salesSnapshot?.period_discount || 0);
    const refundsPeriod = Number(refunds?.refunded || 0);
    const netProfit = round2(
      salesPeriod - purchasesPeriod - discountsPeriod - refundsPeriod - expensesPeriod
    );

    const pctChange = (current: number, previous: number) => {
      if (previous <= 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    // Daily trend fill for period (cap sparkline points)
    const byDay = new Map(
      (salesTrendRows || []).map((r) => [String(r.day).slice(0, 10), Number(r.total)])
    );
    const salesTrend: Array<{ date: string; label: string; total: number }> = [];
    const start = new Date(from);
    const end = new Date(to);
    const days = Math.min(
      31,
      Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1)
    );
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      salesTrend.push({
        date: key,
        label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        total: byDay.get(key) ?? 0
      });
    }

    return ok({
      period: range,
      sales: {
        today: Number(salesSnapshot?.today || 0),
        week: Number(salesSnapshot?.week || 0),
        month: Number(salesSnapshot?.month || 0),
        period: salesPeriod,
        all_time: Number(salesSnapshot?.all_time || 0),
        order_count: Number(orderCounts?.total || 0),
        paid_orders: Number(orderCounts?.paid || 0),
        pending_orders: Number(orderCounts?.pending || 0),
        cancelled_orders: Number(orderCounts?.cancelled || 0),
        returned_orders: Number(orderCounts?.returned || Number(refunds?.return_count || 0))
      },
      payments: {
        total_revenue: Number(paymentMix?.total_paid || 0),
        cash: Number(paymentMix?.cash || 0),
        upi: Number(paymentMix?.upi || 0),
        card: Number(paymentMix?.card || 0),
        online: Number(paymentMix?.online || 0),
        other: Number(paymentMix?.other || 0),
        pending_customer: Number(paymentMix?.pending_ar || 0),
        refunded: refundsPeriod
      },
      purchases: {
        period: purchasesPeriod,
        today: Number(purchaseSnap?.today || 0),
        month: Number(purchaseSnap?.month || 0),
        pending_supplier: Number(purchaseSnap?.pending || 0)
      },
      expenses: {
        today: Number(expenseSnap?.today || 0),
        month: Number(expenseSnap?.month || 0),
        period: expensesPeriod,
        total: Number(expenseSnap?.total || 0),
        by_category: (expenseByCategory || []).map((r) => ({
          category: r.category,
          total: Number(r.total)
        }))
      },
      profit: {
        sales_revenue: salesPeriod,
        purchases: purchasesPeriod,
        discounts: discountsPeriod,
        refunds: refundsPeriod,
        expenses: expensesPeriod,
        net_profit: netProfit
      },
      inventory: {
        total_products: Number(inventory?.total || 0),
        active_products: Number(inventory?.active || 0),
        low_stock: Number(inventory?.low_stock || 0),
        out_of_stock: Number(inventory?.out_of_stock || 0),
        pending_approval: Number(inventory?.pending_approval || 0)
      },
      customers: {
        total: Number(customers?.total || 0),
        new_in_period: Number(customers?.new_in_period || 0),
        returning: Number(customers?.returning || 0),
        outstanding: Number(paymentMix?.pending_ar || 0)
      },
      suppliers: {
        total: Number(suppliers?.total || 0),
        active: Number(suppliers?.active || 0),
        outstanding: Number(purchaseSnap?.pending || 0)
      },
      charts: {
        sales_trend: salesTrend,
        monthly_trend: (monthlyTrendRows || []).map((r) => ({
          label: r.month,
          total: Number(r.total)
        })),
        sales_by_category: (salesByCategory || []).map((r) => ({
          label: r.category,
          value: Number(r.total)
        })),
        sales_by_payment_method: [
          { label: "Cash", value: Number(paymentMix?.cash || 0) },
          { label: "UPI", value: Number(paymentMix?.upi || 0) },
          { label: "Card", value: Number(paymentMix?.card || 0) },
          { label: "Online", value: Number(paymentMix?.online || 0) },
          { label: "Other", value: Number(paymentMix?.other || 0) }
        ].filter((x) => x.value > 0)
      },
      statusBreakdown: (statusBreakdown || []).map((row) => ({
        status: row.status,
        count: Number(row.count)
      })),
      trends: {
        salesChangePct: pctChange(salesPeriod, Number(periodCompare?.sales_prev || 0)),
        ordersChangePct: pctChange(
          Number(orderCounts?.total || 0),
          Number(periodCompare?.orders_prev || 0)
        )
      },
      // Backward-compatible summary used by older UI bits
      summary: {
        products: Number(inventory?.total || 0),
        orders: Number(orderCounts?.total || 0),
        users: Number(customers?.total || 0),
        customers: Number(customers?.total || 0),
        lowStock: Number(inventory?.low_stock || 0),
        salesTotal: salesPeriod
      },
      recent: {
        orders: recentOrders,
        payments: recentPayments,
        purchases: recentPurchases,
        expenses: recentExpenses,
        returns: recentReturns,
        activity: (recentActivity || []).map((row) => ({
          id: row.id,
          action: row.action,
          entityType: row.entity_type,
          actorName: row.actor_name,
          createdAt: row.created_at
        }))
      }
    });
  } catch (err) {
    console.error("[admin/dashboard]", err);
    const message = err instanceof Error ? err.message : "Dashboard query failed";
    return fail(message, 500);
  }
}
