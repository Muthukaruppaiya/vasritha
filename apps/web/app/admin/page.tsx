"use client";

import Link from "next/link";
import {
  IndianRupee,
  Package,
  ShoppingBag,
  Users,
  AlertTriangle,
  ArrowUpRight,
  Tags,
  TicketPercent,
  Zap,
  Settings,
  Activity,
  LineChart,
  PieChart
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

type DashboardData = {
  summary: {
    products: number;
    orders: number;
    users: number;
    customers?: number;
    lowStock: number;
    salesTotal: number;
  };
  trends: {
    salesChangePct: number;
    ordersChangePct: number;
  };
  salesTrend: Array<{ date: string; label: string; total: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  categoryComposition: Array<{ category: string; count: number }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    actorName: string | null;
    createdAt: string;
  }>;
  recentOrders: Array<{
    id: string;
    order_number: string;
    status: string;
    payment_status: string;
    total_amount: string;
    created_at: string;
  }>;
};

const quickLinks = [
  { href: "/admin/products", label: "Add product", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/users", label: "Manage users", icon: Users },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/admin/settings", label: "Settings", icon: Settings }
];

function activityLabel(action: string, entityType: string) {
  const entity = entityType.replace(/_/g, " ");
  const verbs: Record<string, string> = {
    create: "created a",
    update: "updated a",
    update_status: "updated status of a",
    archive: "archived a",
    assign_role: "assigned a role to a",
    inventory_movement: "posted a stock movement on",
    return_requested: "requested a return for",
    return_status: "updated a return for"
  };
  return `${verbs[action] || action.replace(/_/g, " ")} ${entity}`;
}

export default function AdminDashboardPage() {
  const { data, error, loading } = useAdminQuery<DashboardData>("/api/admin/dashboard");

  const stats = data
    ? [
        {
          label: "Paid sales",
          value: formatMoney(data.summary.salesTotal),
          hint: "Completed payments",
          icon: IndianRupee,
          tone: "sales",
          trend: data.trends.salesChangePct
        },
        {
          label: "Orders",
          value: String(data.summary.orders),
          hint: "Total placed",
          icon: ShoppingBag,
          tone: "orders",
          trend: data.trends.ordersChangePct
        },
        {
          label: "Users",
          value: String(data.summary.users ?? data.summary.customers ?? 0),
          hint: "Staff & accounts",
          icon: Users,
          tone: "users",
          trend: null
        },
        {
          label: "Products",
          value: String(data.summary.products),
          hint: "Catalogue items",
          icon: Package,
          tone: "products",
          trend: null
        }
      ]
    : [];

  return (
    <div className="admin-dashboard">
      {loading && <AdminLoading />}
      {error && <p className="admin-alert admin-alert--error">{error}</p>}

      {data && (
        <>
          <section className="admin-dash-hero">
            <div>
              <p className="admin-dash-kicker">Today at Vasritha</p>
              <h2>Boutique performance at a glance</h2>
              <p className="muted">
                Track sales, orders, catalogue health and staff access from one place.
              </p>
            </div>
            <div className="admin-dash-hero-actions">
              <Link href="/admin/orders" className="admin-dash-chip">
                Online Orders <ArrowUpRight size={14} />
              </Link>
              <Link href="/admin/billing" className="admin-dash-chip">
                Store POS <ArrowUpRight size={14} />
              </Link>
              <Link href="/admin/inventory" className="admin-dash-chip">
                Inventory <ArrowUpRight size={14} />
              </Link>
            </div>
          </section>

          <section className="admin-stats">
            {stats.map((stat) => {
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

          {data.summary.lowStock > 0 && (
            <div className="admin-dash-alert">
              <AlertTriangle size={16} />
              <span>
                {data.summary.lowStock} product{data.summary.lowStock === 1 ? "" : "s"} at low stock
                (5 or fewer).
              </span>
              <Link href="/admin/inventory">Review inventory</Link>
            </div>
          )}

          <div className="admin-dash-insights">
            <AdminPanel
              className="admin-dash-trend"
              title="Sales trend"
              actions={<span className="admin-panel-icon"><LineChart size={15} /></span>}
            >
              <AdminSparkline
                points={data.salesTrend.map((p) => ({ label: p.label, total: p.total }))}
              />
              <p className="muted admin-dash-trend-note">Paid sales, last 7 days</p>
            </AdminPanel>

            <AdminPanel
              className="admin-dash-status"
              title="Order status"
              actions={<span className="admin-panel-icon"><PieChart size={15} /></span>}
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
                <AdminEmpty title="No orders yet" />
              )}
            </AdminPanel>

            <AdminPanel
              className="admin-dash-catalogue"
              title="Catalogue by category"
              actions={<span className="admin-panel-icon"><Tags size={15} /></span>}
            >
              {data.categoryComposition.length ? (
                <AdminBarList
                  items={data.categoryComposition.map((c) => ({
                    label: c.category,
                    value: c.count
                  }))}
                />
              ) : (
                <AdminEmpty title="No categories yet" />
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
              {!data.recentOrders.length ? (
                <AdminEmpty
                  title="No orders yet"
                  body="Orders will appear here after checkout."
                />
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Date</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentOrders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <b>{order.order_number}</b>
                          </td>
                          <td>{formatDate(order.created_at)}</td>
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
              className="admin-dash-activity"
              title="Recent activity"
              actions={<span className="admin-panel-icon"><Activity size={15} /></span>}
            >
              {!data.recentActivity.length ? (
                <AdminEmpty title="No activity yet" body="Admin actions will show up here." />
              ) : (
                <ul className="admin-activity-list">
                  {data.recentActivity.map((item) => (
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
