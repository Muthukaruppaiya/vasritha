"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer, X } from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  statusTone
} from "../../../../components/admin/admin-ui";
import {
  CollectionReceipt,
  type CollectionReceiptData
} from "../../../../components/admin/collection-receipt";
import { adminFetch, formatDate, formatMoney } from "../../../../lib/admin-api";
import { useAdminQuery } from "../../../../hooks/use-admin-query";
import { OPS_PLATFORM_NAME } from "../../../../lib/platform";

type DueBill = {
  order_id: string;
  order_number: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  invoice_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  days_overdue: number;
  status_label: string;
};

type CustomerGroup = {
  key: string;
  customer_name: string;
  customer_phone: string | null;
  bill_count: number;
  outstanding_amount: number;
  bills: DueBill[];
};

type Payload = {
  rows: DueBill[];
  customers: CustomerGroup[];
  totals: {
    outstanding: number;
    customer_count: number;
    bill_count: number;
  };
};

type CollectResult = CollectionReceiptData & {
  order_id?: string;
  loyalty?: unknown;
};

export default function PosCreditDuesPage() {
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [collectMethod, setCollectMethod] = useState<"cash" | "upi" | "card">("cash");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [receipt, setReceipt] = useState<CollectionReceiptData | null>(null);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (submittedQ) params.set("q", submittedQ);
    params.set("_", String(tick));
    const qs = params.toString();
    return `/api/admin/pos/dues?${qs}`;
  }, [submittedQ, tick]);

  const { data, error: loadError, loading } = useAdminQuery<Payload>(path);

  useEffect(() => {
    if (!receipt) return;
    const t = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(t);
  }, [receipt]);

  const openCollect = (bill: DueBill) => {
    setCollectingId(bill.order_id);
    setCollectAmount(String(bill.outstanding_amount));
    setCollectMethod("cash");
    setError("");
    setMessage("");
  };

  const submitCollect = async (bill: DueBill) => {
    const amount = Math.round(Math.max(0, Number(collectAmount) || 0) * 100) / 100;
    if (amount <= 0) {
      setError("Enter amount to collect");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const result = await adminFetch<CollectResult>("/api/admin/pos/collect", {
      method: "POST",
      json: {
        orderId: bill.order_id,
        amount,
        method: collectMethod
      }
    });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    const payload = result.data;
    if (payload) {
      setReceipt({
        order_number: payload.order_number,
        collected_at: payload.collected_at || new Date().toISOString(),
        customer_name: payload.customer_name ?? bill.customer_name,
        customer_phone: payload.customer_phone ?? bill.customer_phone,
        invoice_amount: Number(payload.invoice_amount ?? bill.invoice_amount),
        collected: Number(payload.collected || amount),
        paid_amount: Number(payload.paid_amount || 0),
        balance_due: Number(payload.balance_due || 0),
        fully_paid: Boolean(payload.fully_paid),
        method: payload.method || collectMethod,
        seller: payload.seller || null
      });
      setMessage(
        payload.fully_paid
          ? `${payload.order_number} fully settled.`
          : `Collected ${formatMoney(payload.collected || 0)} · balance ${formatMoney(payload.balance_due || 0)}`
      );
    }
    setCollectingId(null);
    setTick((n) => n + 1);
  };

  return (
    <div className="admin-stack dues-page">
      <AdminPageHeader eyebrow={OPS_PLATFORM_NAME} title="Store credit dues" />

      <form
        className="dues-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedQ(q.trim());
        }}
      >
        <label className="admin-grow">
          <span>Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Invoice / mobile / customer name"
          />
        </label>
        <button className="btn" type="submit">
          Search
        </button>
      </form>

      {loadError || error ? <AdminAlert>{loadError || error}</AdminAlert> : null}
      {message ? <AdminAlert tone="ok">{message}</AdminAlert> : null}

      <div className="dues-summary">
        <div className="dues-stat">
          <span>Total due</span>
          <strong>{formatMoney(data?.totals.outstanding || 0)}</strong>
        </div>
        <div className="dues-stat">
          <span>Customers</span>
          <strong>{data?.totals.customer_count ?? "—"}</strong>
        </div>
        <div className="dues-stat">
          <span>Open bills</span>
          <strong>{data?.totals.bill_count ?? "—"}</strong>
        </div>
      </div>

      <AdminPanel title="Who should pay">
        {loading ? <AdminLoading /> : null}
        {!loading && !(data?.customers || []).length ? (
          <AdminEmpty title="No credit dues" />
        ) : null}

        <div className="dues-list">
          {(data?.customers || []).map((group) => (
            <article key={group.key} className="dues-customer">
              <header className="dues-customer-head">
                <div>
                  <strong>{group.customer_name}</strong>
                  <p className="muted">
                    {group.customer_phone || "—"} · {group.bill_count} bill
                    {group.bill_count === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="dues-customer-due">
                  <span>Should give</span>
                  <strong>{formatMoney(group.outstanding_amount)}</strong>
                </div>
              </header>

              <div className="admin-table-wrap">
                <table className="admin-table admin-table--zebra">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Invoice</th>
                      <th>Bill</th>
                      <th>Paid</th>
                      <th>Due</th>
                      <th>Age</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {group.bills.map((bill) => (
                      <tr key={bill.order_id}>
                        <td>{formatDate(bill.created_at)}</td>
                        <td>
                          <b>{bill.order_number}</b>
                        </td>
                        <td>{formatMoney(bill.invoice_amount)}</td>
                        <td>{formatMoney(bill.paid_amount)}</td>
                        <td>
                          <b>{formatMoney(bill.outstanding_amount)}</b>
                        </td>
                        <td>{bill.days_overdue}d</td>
                        <td>
                          <AdminBadge tone={statusTone(bill.status_label.toLowerCase())}>
                            {bill.status_label}
                          </AdminBadge>
                        </td>
                        <td>
                          {collectingId === bill.order_id ? (
                            <div className="dues-collect">
                              <input
                                type="number"
                                min={0.01}
                                step="0.01"
                                max={bill.outstanding_amount}
                                value={collectAmount}
                                onChange={(e) => setCollectAmount(e.target.value)}
                                disabled={busy}
                                aria-label="Collect amount"
                              />
                              <select
                                value={collectMethod}
                                onChange={(e) =>
                                  setCollectMethod(e.target.value as "cash" | "upi" | "card")
                                }
                                disabled={busy}
                                aria-label="Payment method"
                              >
                                <option value="cash">Cash</option>
                                <option value="upi">UPI</option>
                                <option value="card">Card</option>
                              </select>
                              <button
                                type="button"
                                className="btn"
                                disabled={busy}
                                onClick={() => void submitCollect(bill)}
                              >
                                {busy ? "…" : "Collect"}
                              </button>
                              <button
                                type="button"
                                className="btn admin-ghost-btn"
                                disabled={busy}
                                onClick={() => setCollectingId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn admin-ghost-btn"
                              onClick={() => openCollect(bill)}
                            >
                              Collect
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      </AdminPanel>

      {receipt ? (
        <div className="pos-invoice-overlay" role="dialog" aria-modal="true">
          <div className="pos-invoice-sheet pos-invoice-sheet--a4">
            <CollectionReceipt data={receipt} id="dues-collection-print" />
            <div className="pos-invoice-actions">
              <button type="button" className="btn" onClick={() => window.print()}>
                <Printer size={14} />
                Print receipt
              </button>
              <button type="button" className="btn ghost" onClick={() => setReceipt(null)}>
                <X size={14} />
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
