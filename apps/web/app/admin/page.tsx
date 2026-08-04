"use client";

import Link from "next/link";
import { AdminBadge, AdminEmpty, AdminLoading, AdminPageHeader, AdminPanel, statusTone } from "../../components/admin/admin-ui";
import { formatDate, formatMoney } from "../../lib/admin-api";
import { useAdminQuery } from "../../hooks/use-admin-query";

type DashboardData = {
  summary: {
    products: number;
    orders: number;
    customers: number;
    salesTotal: number;
  };
  recentOrders: Array<{
    id: string;
    order_number: string;
    status: string;
    payment_status: string;
    total_amount: string;
    created_at: string;
  }>;
};

export default function AdminDashboardPage() {
  const { data, error, loading } = useAdminQuery<DashboardData>("/api/admin/dashboard");

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description="Live boutique overview from local PostgreSQL."
        actions={
          <Link href="/admin/products" className="btn">
            + New product
          </Link>
        }
      />

      {loading && <AdminLoading />}
      {error && <p className="admin-alert admin-alert--error">{error}</p>}

      {data && (
        <>
          <section className="admin-stats">
            <article className="admin-stat">
              <span className="muted">Paid sales</span>
              <strong>{formatMoney(data.summary.salesTotal)}</strong>
              <span className="muted">All paid orders</span>
            </article>
            <article className="admin-stat">
              <span className="muted">Orders</span>
              <strong>{data.summary.orders}</strong>
              <span className="muted">Total placed</span>
            </article>
            <article className="admin-stat">
              <span className="muted">Customers</span>
              <strong>{data.summary.customers}</strong>
              <span className="muted">Registered buyers</span>
            </article>
            <article className="admin-stat">
              <span className="muted">Products</span>
              <strong>{data.summary.products}</strong>
              <span className="muted">Catalogue items</span>
            </article>
          </section>

          <AdminPanel
            title="Recent orders"
            actions={
              <Link href="/admin/orders" className="admin-text-link">
                View all
              </Link>
            }
          >
            {!data.recentOrders.length ? (
              <AdminEmpty title="No orders yet" body="Orders will appear here after checkout." />
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
        </>
      )}
    </>
  );
}
