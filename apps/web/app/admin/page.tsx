"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  IndianRupee,
  Package,
  ShoppingBag,
  AlertTriangle,
  ArrowUpRight,
  Tags,
  TicketPercent,
  Zap,
  Settings,
  Activity,
  LineChart,
  PieChart,
  Wallet,
  Truck,
  RotateCcw
} from "lucide-react";
import {
  AdminBadge,
  AdminBarList,
  AdminEmpty,
  AdminLoading,
  AdminPanel,
  AdminSparkline,
  AdminTrend,
  statusTone
} from "../../components/admin/admin-ui";
import { formatMoney, formatDate } from "../../lib/admin-api";
import { useAdminQuery } from "../../hooks/use-admin-query";
import { PERIOD_OPTIONS } from "../../lib/finance-period";
import { CATEGORY_LABELS } from "../../lib/finance-labels";

type DashboardData = {
  period: { from: string; to: string; key: string };
  sales: {
    today: number;
    week: number;
    month: number;
    period: number;
    all_time: number;
    order_count: number;
    paid_orders: number;
    pending_orders: number;
    cancelled_orders: number;
    returned_orders: number;
  };
  payments: {
    total_revenue: number;
    cash: number;
    upi: number;
    card: number;
    online: number;
    other: number;
    pending_customer: number;
    refunded: number;
  };
  purchases: {
    period: number;
    today: number;
    month: number;
    pending_supplier: number;
  };
  expenses: {
    today: number;
    month: number;
    period: number;
    total: number;
    by_category: Array<{ category: string; total: number }>;
  };
  profit: {
    sales_revenue: number;
    purchases: number;
    discounts: number;
    refunds: number;
    expenses: number;
    net_profit: number;
  };
  inventory: {
    total_products: number;
    active_products: number;
    low_stock: number;
    out_of_stock: number;
    pending_approval: number;
  };
  customers: {
    total: number;
    new_in_period: number;
    returning: number;
    outstanding: number;
  };
  suppliers: {
    total: number;
    active: number;
    outstanding: number;
  };
  charts: {
    sales_trend: Array<{ date: string; label: string; total: number }>;
    monthly_trend: Array<{ label: string; total: number }>;
    sales_by_category: Array<{ label: string; value: number }>;
    sales_by_payment_method: Array<{ label: string; value: number }>;
  };
  statusBreakdown: Array<{ status: string; count: number }>;
  trends: { salesChangePct: number; ordersChangePct: number };
  summary: {
    products: number;
    orders: number;
    users: number;
    customers?: number;
    lowStock: number;
    salesTotal: number;
  };
  recent: {
    orders: Array<{
      id: string;
      order_number: string;
      status: string;
      payment_status: string;
      total_amount: string;
      created_at: string;
      channel?: string;
    }>;
    payments: Array<{
      id: string;
      amount: string;
      provider: string;
      status: string;
      created_at: string;
      order_number: string;
    }>;
    purchases: Array<{
      id: string;
      entry_no: string;
      amount: string | number;
      status: string;
      entry_date: string;
      counterparty_name: string | null;
      reference_no: string | null;
    }>;
    expenses: Array<{
      id: string;
      entry_no: string;
      category: string;
      amount: string | number;
      entry_date: string;
      counterparty_name: string | null;
    }>;
    returns: Array<{
      id: string;
      status: string;
      refund_amount: string | number;
      created_at: string;
      order_number: string;
    }>;
    activity: Array<{
      id: string;
      action: string;
      entityType: string;
      actorName: string | null;
      createdAt: string;
    }>;
  };
};

const quickLinks = [
  { href: "/admin/billing", label: "Store POS", icon: IndianRupee },
  { href: "/admin/orders", label: "Online orders", icon: ShoppingBag },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/inventory", label: "Inventory", icon: Tags },
  { href: "/admin/finance", label: "Finance", icon: Wallet },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/admin/settings", label: "Settings", icon: Settings }
];

const DASH_PERIODS = PERIOD_OPTIONS.filter((p) =>
  ["today", "yesterday", "this_week", "this_month", "previous_month", "this_year", "custom"].includes(
    p.value
  )
);

function activityLabel(action: string, entityType: string) {
  const entity = entityType.replace(/_/g, " ");
  const verbs: Record<string, string> = {
    create: "created a",
    update: "updated a",
    update_status: "updated status of a",
    archive: "archived a",
    assign_role: "assigned a role to a",
    inventory_movement: "posted a stock movement on",
    inventory_inward: "received GRN for",
    inventory_grn_submit: "submitted GRN",
    return_requested: "requested a return for",
    return_status: "updated a return for"
  };
  return `${verbs[action] || action.replace(/_/g, " ")} ${entity}`;
}

function Metric({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="admin-dash-metric">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      {hint ? <span className="muted admin-sub">{hint}</span> : null}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState("this_month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const path = useMemo(() => {
    const params = new URLSearchParams({ period });
    if (period === "custom") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    return `/api/admin/dashboard?${params.toString()}`;
  }, [period, from, to]);

  const { data, error, loading, reload } = useAdminQuery<DashboardData>(path);

  const heroStats = data
    ? [
        {
          label: "Period sales",
          value: formatMoney(data.sales.period),
          hint: `${data.period.from} → ${data.period.to}`,
          icon: IndianRupee,
          tone: "sales",
          trend: data.trends.salesChangePct
        },
        {
          label: "Orders",
          value: String(data.sales.order_count),
          hint: `${data.sales.paid_orders} paid`,
          icon: ShoppingBag,
          tone: "orders",
          trend: data.trends.ordersChangePct
        },
        {
          label: "Net profit",
          value: formatMoney(data.profit.net_profit),
          hint: "Sales − purchase − discount − refund − expense",
          icon: Wallet,
          tone: "users",
          trend: null as number | null
        },
        {
          label: "Low stock",
          value: String(data.inventory.low_stock),
          hint: `${data.inventory.out_of_stock} out of stock`,
          icon: Package,
          tone: "products",
          trend: null as number | null
        }
      ]
    : [];

  return (
    <div className="admin-dashboard">
      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          void reload();
        }}
      >
        <label>
          <span>Period</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {DASH_PERIODS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        {period === "custom" ? (
          <>
            <label>
              <span>From</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              <span>To</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        ) : null}
        <button className="btn" type="submit">
          Apply
        </button>
      </form>

      {loading && <AdminLoading />}
      {error && <p className="admin-alert admin-alert--error">{error}</p>}

      {data && (
        <>
          <section className="admin-dash-hero">
            <div>
              <p className="admin-dash-kicker">Boutique overview</p>
              <h2>Business dashboard</h2>
              <p className="muted">
                Live numbers from orders, billing, payments, purchases, expenses and inventory.
              </p>
            </div>
            <div className="admin-dash-hero-actions">
              <Link href="/admin/orders" className="admin-dash-chip">
                Online Orders <ArrowUpRight size={14} />
              </Link>
              <Link href="/admin/billing" className="admin-dash-chip">
                Store POS <ArrowUpRight size={14} />
              </Link>
              <Link href="/admin/finance" className="admin-dash-chip">
                Finance <ArrowUpRight size={14} />
              </Link>
            </div>
          </section>

          <section className="admin-stats">
            {heroStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <article key={stat.label} className={`admin-stat admin-stat--${stat.tone}`}>
                  <div className="admin-stat-top">
                    <span className="muted">{stat.label}</span>
                    <span className="admin-stat-icon">
                      <Icon size={16} />
                    </span>
                  </div>
                  <strong>{stat.value}</strong>
                  <div className="admin-stat-foot">
                    <span className="muted">{stat.hint}</span>
                    {stat.trend !== null && <AdminTrend value={stat.trend} />}
                  </div>
                </article>
              );
            })}
          </section>

          {(data.inventory.low_stock > 0 || data.inventory.out_of_stock > 0) && (
            <div className="admin-dash-alert">
              <AlertTriangle size={16} />
              <span>
                {data.inventory.low_stock} low-stock · {data.inventory.out_of_stock} out of stock
                {data.inventory.pending_approval
                  ? ` · ${data.inventory.pending_approval} pending approval`
                  : ""}
              </span>
              <Link href="/admin/inventory">Review inventory</Link>
            </div>
          )}

          <div className="admin-card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <AdminPanel title="Sales summary">
              <div className="admin-dash-metric-grid">
                <Metric label="Today" value={formatMoney(data.sales.today)} />
                <Metric label="This week" value={formatMoney(data.sales.week)} />
                <Metric label="This month" value={formatMoney(data.sales.month)} />
                <Metric label="Period total" value={formatMoney(data.sales.period)} />
                <Metric label="All-time paid" value={formatMoney(data.sales.all_time)} />
                <Metric label="Orders" value={String(data.sales.order_count)} />
                <Metric label="Paid orders" value={String(data.sales.paid_orders)} />
                <Metric label="Pending pay" value={String(data.sales.pending_orders)} />
                <Metric label="Cancelled" value={String(data.sales.cancelled_orders)} />
                <Metric label="Returns" value={String(data.sales.returned_orders)} />
              </div>
            </AdminPanel>

            <AdminPanel title="Revenue / payments">
              <div className="admin-dash-metric-grid">
                <Metric label="Collected" value={formatMoney(data.payments.total_revenue)} />
                <Metric label="Cash" value={formatMoney(data.payments.cash)} />
                <Metric label="UPI" value={formatMoney(data.payments.upi)} />
                <Metric label="Card" value={formatMoney(data.payments.card)} />
                <Metric label="Online" value={formatMoney(data.payments.online)} />
                <Metric label="Customer dues" value={formatMoney(data.payments.pending_customer)} />
                <Metric label="Refunded" value={formatMoney(data.payments.refunded)} />
              </div>
            </AdminPanel>

            <AdminPanel title="Purchases">
              <div className="admin-dash-metric-grid">
                <Metric label="Today" value={formatMoney(data.purchases.today)} />
                <Metric label="This month" value={formatMoney(data.purchases.month)} />
                <Metric label="Period" value={formatMoney(data.purchases.period)} />
                <Metric
                  label="Supplier dues"
                  value={formatMoney(data.purchases.pending_supplier)}
                />
              </div>
              <p className="muted admin-sub" style={{ marginTop: 8 }}>
                From finance purchase bills (GRN sync).
              </p>
            </AdminPanel>

            <AdminPanel title="Expenses">
              <div className="admin-dash-metric-grid">
                <Metric label="Today" value={formatMoney(data.expenses.today)} />
                <Metric label="This month" value={formatMoney(data.expenses.month)} />
                <Metric label="Period" value={formatMoney(data.expenses.period)} />
                <Metric label="All-time" value={formatMoney(data.expenses.total)} />
              </div>
              {data.expenses.by_category.length ? (
                <div style={{ marginTop: 12 }}>
                  <AdminBarList
                    tone="brand"
                    items={data.expenses.by_category.map((r) => ({
                      label: CATEGORY_LABELS[r.category] || r.category,
                      value: r.total
                    }))}
                  />
                </div>
              ) : (
                <AdminEmpty title="No expenses in range" />
              )}
            </AdminPanel>
          </div>

          <div className="admin-card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <AdminPanel title="Profit summary">
              <div className="admin-dash-metric-grid">
                <Metric label="Sales revenue" value={formatMoney(data.profit.sales_revenue)} />
                <Metric label="− Purchases" value={formatMoney(data.profit.purchases)} />
                <Metric label="− Discounts" value={formatMoney(data.profit.discounts)} />
                <Metric label="− Refunds" value={formatMoney(data.profit.refunds)} />
                <Metric label="− Expenses" value={formatMoney(data.profit.expenses)} />
                <Metric label="= Net profit" value={formatMoney(data.profit.net_profit)} />
              </div>
            </AdminPanel>

            <AdminPanel title="Inventory">
              <div className="admin-dash-metric-grid">
                <Metric label="Products" value={String(data.inventory.total_products)} />
                <Metric label="Active" value={String(data.inventory.active_products)} />
                <Metric label="Low stock" value={String(data.inventory.low_stock)} />
                <Metric label="Out of stock" value={String(data.inventory.out_of_stock)} />
                <Metric label="Pending approval" value={String(data.inventory.pending_approval)} />
              </div>
            </AdminPanel>

            <AdminPanel title="Customers">
              <div className="admin-dash-metric-grid">
                <Metric label="Total" value={String(data.customers.total)} />
                <Metric label="New (period)" value={String(data.customers.new_in_period)} />
                <Metric label="Returning" value={String(data.customers.returning)} />
                <Metric label="Outstanding" value={formatMoney(data.customers.outstanding)} />
              </div>
            </AdminPanel>

            <AdminPanel title="Suppliers">
              <div className="admin-dash-metric-grid">
                <Metric label="Total" value={String(data.suppliers.total)} />
                <Metric label="Active" value={String(data.suppliers.active)} />
                <Metric label="Payable" value={formatMoney(data.suppliers.outstanding)} />
              </div>
            </AdminPanel>
          </div>

          <div className="admin-dash-insights">
            <AdminPanel
              className="admin-dash-trend"
              title="Daily sales trend"
              actions={
                <span className="admin-panel-icon">
                  <LineChart size={15} />
                </span>
              }
            >
              {data.charts.sales_trend.some((p) => p.total > 0) ? (
                <AdminSparkline
                  points={data.charts.sales_trend.map((p) => ({
                    label: p.label,
                    total: p.total
                  }))}
                />
              ) : (
                <AdminEmpty title="No paid sales in this period" />
              )}
            </AdminPanel>

            <AdminPanel
              className="admin-dash-status"
              title="Order status"
              actions={
                <span className="admin-panel-icon">
                  <PieChart size={15} />
                </span>
              }
            >
              {data.statusBreakdown.length ? (
                <AdminBarList
                  tone="brand"
                  items={data.statusBreakdown.map((s) => ({
                    label: s.status,
                    value: s.count
                  }))}
                />
              ) : (
                <AdminEmpty title="No orders in period" />
              )}
            </AdminPanel>

            <AdminPanel title="Sales by category">
              {data.charts.sales_by_category.length ? (
                <AdminBarList
                  items={data.charts.sales_by_category.map((c) => ({
                    label: c.label,
                    value: c.value
                  }))}
                />
              ) : (
                <AdminEmpty title="No category sales" />
              )}
            </AdminPanel>

            <AdminPanel title="Sales by payment method">
              {data.charts.sales_by_payment_method.length ? (
                <AdminBarList
                  tone="brand"
                  items={data.charts.sales_by_payment_method.map((c) => ({
                    label: c.label,
                    value: c.value
                  }))}
                />
              ) : (
                <AdminEmpty title="No payments in period" />
              )}
            </AdminPanel>

            <AdminPanel title="Monthly sales (6 months)">
              {data.charts.monthly_trend.length ? (
                <AdminSparkline points={data.charts.monthly_trend} />
              ) : (
                <AdminEmpty title="No monthly history" />
              )}
            </AdminPanel>
          </div>

          <AdminPanel className="admin-dash-actions">
            <div className="admin-panel-head">
              <h3 className="admin-dash-actions-title">
                <span className="admin-dash-actions-icon">
                  <Zap size={16} />
                </span>
                Quick actions
              </h3>
            </div>
            <div className="admin-dash-links">
              {quickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="admin-dash-link">
                    <span className="admin-dash-link-icon">
                      <Icon size={18} />
                    </span>
                    <span className="admin-dash-link-label">{item.label}</span>
                    <ArrowUpRight size={14} className="admin-dash-link-arrow" />
                  </Link>
                );
              })}
            </div>
          </AdminPanel>

          <div className="admin-dash-grid">
            <AdminPanel
              className="admin-dash-orders"
              title="Recent orders"
              actions={
                <Link href="/admin/orders" className="admin-text-link">
                  View all
                </Link>
              }
            >
              {!data.recent.orders.length ? (
                <AdminEmpty title="No orders yet" body="Orders will appear after checkout or POS." />
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Date</th>
                        <th>Channel</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.orders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <b>{order.order_number}</b>
                          </td>
                          <td>{formatDate(order.created_at)}</td>
                          <td>{order.channel || "—"}</td>
                          <td>
                            <AdminBadge tone={statusTone(order.payment_status)}>
                              {order.payment_status}
                            </AdminBadge>
                          </td>
                          <td>
                            <AdminBadge tone={statusTone(order.status)}>{order.status}</AdminBadge>
                          </td>
                          <td>{formatMoney(order.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminPanel>

            <AdminPanel
              title="Recent payments"
              actions={
                <span className="admin-panel-icon">
                  <Wallet size={15} />
                </span>
              }
            >
              {!data.recent.payments.length ? (
                <AdminEmpty title="No payments yet" />
              ) : (
                <ul className="admin-activity-list">
                  {data.recent.payments.map((p) => (
                    <li key={p.id} className="admin-activity-item">
                      <span className="admin-activity-dot" />
                      <div>
                        <p>
                          <b>{formatMoney(p.amount)}</b> · {p.provider} · {p.order_number}
                        </p>
                        <span className="muted admin-sub">
                          {formatDate(p.created_at)} · {p.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AdminPanel>
          </div>

          <div className="admin-dash-grid">
            <AdminPanel
              title="Recent purchases"
              actions={
                <span className="admin-panel-icon">
                  <Truck size={15} />
                </span>
              }
            >
              {!data.recent.purchases.length ? (
                <AdminEmpty title="No purchase bills" body="GRN inward will sync here." />
              ) : (
                <ul className="admin-activity-list">
                  {data.recent.purchases.map((p) => (
                    <li key={p.id} className="admin-activity-item">
                      <span className="admin-activity-dot" />
                      <div>
                        <p>
                          <b>{formatMoney(p.amount)}</b> · {p.counterparty_name || "Supplier"}
                        </p>
                        <span className="muted admin-sub">
                          {formatDate(p.entry_date)} · {p.reference_no || p.entry_no} · {p.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AdminPanel>

            <AdminPanel title="Recent expenses">
              {!data.recent.expenses.length ? (
                <AdminEmpty title="No expenses" body="Add expenses under Finance." />
              ) : (
                <ul className="admin-activity-list">
                  {data.recent.expenses.map((e) => (
                    <li key={e.id} className="admin-activity-item">
                      <span className="admin-activity-dot" />
                      <div>
                        <p>
                          <b>{formatMoney(e.amount)}</b> ·{" "}
                          {CATEGORY_LABELS[e.category] || e.category}
                        </p>
                        <span className="muted admin-sub">
                          {formatDate(e.entry_date)} · {e.counterparty_name || e.entry_no}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AdminPanel>

            <AdminPanel
              title="Recent returns"
              actions={
                <span className="admin-panel-icon">
                  <RotateCcw size={15} />
                </span>
              }
            >
              {!data.recent.returns.length ? (
                <AdminEmpty title="No returns" />
              ) : (
                <ul className="admin-activity-list">
                  {data.recent.returns.map((r) => (
                    <li key={r.id} className="admin-activity-item">
                      <span className="admin-activity-dot" />
                      <div>
                        <p>
                          <b>{r.order_number}</b> · {formatMoney(r.refund_amount || 0)}
                        </p>
                        <span className="muted admin-sub">
                          {formatDate(r.created_at)} · {r.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AdminPanel>

            <AdminPanel
              className="admin-dash-activity"
              title="Staff activity"
              actions={
                <span className="admin-panel-icon">
                  <Activity size={15} />
                </span>
              }
            >
              {!data.recent.activity.length ? (
                <AdminEmpty title="No activity yet" body="Admin actions will show up here." />
              ) : (
                <ul className="admin-activity-list">
                  {data.recent.activity.map((item) => (
                    <li key={item.id} className="admin-activity-item">
                      <span className="admin-activity-dot" />
                      <div>
                        <p>
                          <b>{item.actorName || "Someone"}</b>{" "}
                          {activityLabel(item.action, item.entityType)}
                        </p>
                        <span className="muted admin-sub">{formatDate(item.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AdminPanel>
          </div>
        </>
      )}
    </div>
  );
}
