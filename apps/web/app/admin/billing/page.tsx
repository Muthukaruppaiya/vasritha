"use client";

import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  statusTone
} from "../../../components/admin/admin-ui";
import { formatDate, formatMoney } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: string;
  tax_amount: string;
  shipping_amount: string;
  total_amount: string;
  created_at: string;
};

export default function AdminBillingPage() {
  const { data, error, loading } = useAdminQuery<Order[]>("/api/admin/orders");
  const paid = (data || []).filter((order) => order.payment_status === "paid");
  const selected = paid[0] || (data || [])[0] || null;

  return (
    <>
      <AdminPageHeader
        title="Billing"
        description="Paid invoices and tax-ready order summaries."
      />

      <AdminPanel title="Paid invoices">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !error && !paid.length && (
          <AdminEmpty title="No paid invoices yet" body="Completed payments will appear here." />
        )}
        {!error && paid.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Payment</th>
                  <th>Order status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {paid.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <b>INV-{order.order_number}</b>
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

      {selected && (
        <section className="admin-invoice">
          <div className="admin-invoice-head">
            <div>
              <img className="brand-logo" src="/vasritha-logo.svg" alt="Vasritha" />
              <p className="muted">Timeless Elegance · India</p>
            </div>
            <div>
              <div className="eyebrow">Tax invoice</div>
              <h2>INV-{selected.order_number}</h2>
              <p className="muted">Issued: {formatDate(selected.created_at)}</p>
            </div>
          </div>
          <div className="admin-invoice-meta">
            <div>
              <b>Order</b>
              <p className="muted">{selected.order_number}</p>
            </div>
            <div>
              <b>Payment</b>
              <p className="muted">{selected.payment_status}</p>
            </div>
            <div>
              <b>Fulfilment</b>
              <p className="muted">{selected.status}</p>
            </div>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td>{formatMoney(selected.subtotal)}</td>
              </tr>
              <tr>
                <td>Tax</td>
                <td>{formatMoney(selected.tax_amount)}</td>
              </tr>
              <tr>
                <td>Shipping</td>
                <td>{formatMoney(selected.shipping_amount)}</td>
              </tr>
            </tbody>
          </table>
          <div className="admin-invoice-total">Total: {formatMoney(selected.total_amount)}</div>
        </section>
      )}
    </>
  );
}
