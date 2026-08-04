"use client";

import { useMemo, useState } from "react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  statusTone
} from "../../../components/admin/admin-ui";
import { adminFetch, formatDate, formatMoney } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type Order = {
  id: string;
  order_number: string;
  customer_id: string;
  status: string;
  payment_status: string;
  subtotal: string;
  tax_amount: string;
  shipping_amount: string;
  total_amount: string;
  created_at: string;
};

const STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

export default function AdminOrdersPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const path = useMemo(
    () => `/api/admin/orders${statusFilter ? `?status=${statusFilter}` : ""}`,
    [statusFilter]
  );
  const { data, error, loading, reload } = useAdminQuery<Order[]>(path);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    const result = await adminFetch("/api/admin/orders", {
      method: "PATCH",
      json: { orderId, status }
    });
    setUpdatingId(null);
    if (!result.error) await reload();
  };

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="Track payments and move orders through fulfilment."
      />

      <div className="admin-toolbar">
        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <AdminPanel title="Order queue">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !(data || []).length && (
          <AdminEmpty title="No orders" body="Customer checkouts will land here." />
        )}
        {(data || []).length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Placed</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((order) => (
                  <tr key={order.id}>
                    <td>
                      <b>{order.order_number}</b>
                      <div className="muted admin-sub">{order.id.slice(0, 8)}…</div>
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
                    <td>
                      <select
                        disabled={updatingId === order.id}
                        value={order.status}
                        onChange={(e) => void updateStatus(order.id, e.target.value)}
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
    </>
  );
}
