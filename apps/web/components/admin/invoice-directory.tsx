"use client";

import { useMemo, useState } from "react";
import { Printer, X } from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  statusTone
} from "./admin-ui";
import { ThermalReceipt, type ThermalReceiptData } from "./thermal-receipt";
import { adminFetch, formatDate, formatMoney } from "../../lib/admin-api";
import { useAdminQuery } from "../../hooks/use-admin-query";

type InvoiceRow = {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  payment_status: string;
  status: string;
  total_amount: string;
  created_at: string;
};

type InvoiceChannel = "online" | "pos";

export function InvoiceDirectory({
  channel,
  title
}: {
  channel: InvoiceChannel;
  title: string;
}) {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [selected, setSelected] = useState<ThermalReceiptData | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [actionError, setActionError] = useState("");

  const path = useMemo(() => {
    const params = new URLSearchParams();
    params.set("channel", channel);
    if (channel === "pos") params.set("paymentStatus", "paid");
    return `/api/admin/orders?${params.toString()}`;
  }, [channel]);

  const { data, error, loading } = useAdminQuery<InvoiceRow[]>(path);

  const rows = useMemo(() => {
    const list = data || [];
    const term = submitted.trim().toLowerCase();
    if (!term) return list;
    return list.filter((row) => {
      const haystack = [
        row.order_number,
        row.customer_name,
        row.customer_email,
        row.customer_phone,
        row.payment_status,
        row.status
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [data, submitted]);

  const openInvoice = async (orderId: string) => {
    setLoadingInvoice(true);
    setActionError("");
    const result = await adminFetch<ThermalReceiptData>(`/api/admin/orders/${orderId}`);
    setLoadingInvoice(false);
    if (result.error || !result.data) {
      setActionError(result.error || "Could not load invoice");
      return;
    }
    setSelected(result.data);
  };

  const isStore = channel === "pos";

  return (
    <>
      <AdminPageHeader title={title} />

      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q.trim());
        }}
      >
        <label className="admin-grow">
          <span>Search</span>
          <input
            placeholder="Invoice no, customer, email or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button className="btn" type="submit">
          Search
        </button>
      </form>

      <AdminPanel title={isStore ? "Store invoices" : "Online invoices"}>
        {(loading || loadingInvoice) && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {actionError && <AdminAlert>{actionError}</AdminAlert>}
        {!loading && !rows.length && (
          <AdminEmpty
            title={isStore ? "No store invoices yet" : "No online invoices yet"}
            body={
              isStore
                ? "Paid in-store POS sales appear here."
                : "Online storefront orders appear here."
            }
          />
        )}
        {rows.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.id} onClick={() => void openInvoice(order.id)}>
                    <td>
                      <b>INV-{order.order_number}</b>
                    </td>
                    <td>
                      <div>{order.customer_name || "—"}</div>
                      <div className="muted admin-sub">
                        {order.customer_email || order.customer_phone || ""}
                      </div>
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
        <div className="pos-invoice-overlay" role="dialog" aria-modal="true">
          <div className="pos-invoice-sheet pos-invoice-sheet--thermal">
            <div className="tvs-receipt-preview-label">
              Preview · TVS LP 46 (108 mm thermal)
            </div>
            <ThermalReceipt data={selected} id={`${channel}-invoice-print`} />
            <div className="pos-invoice-actions">
              <button type="button" className="btn" onClick={() => window.print()}>
                <Printer size={14} />
                Print on TVS LP 46
              </button>
              <button type="button" className="btn ghost" onClick={() => setSelected(null)}>
                <X size={14} />
                Close
              </button>
            </div>
            <p className="tvs-print-hint muted">
              In the print dialog, choose <b>TVS LP 46</b>, paper size ~108 mm / continuous, margins
              none or minimum, scale 100%.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
