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
} from "../../../../components/admin/admin-ui";
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

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (submittedQ) params.set("q", submittedQ);
    params.set("_", String(tick));
    const qs = params.toString();
    return `/api/admin/pos/dues?${qs}`;
  }, [submittedQ, tick]);

  const { data, error: loadError, loading } = useAdminQuery<Payload>(path);

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
    const result = await adminFetch<{
      collected: number;
      balance_due: number;
      fully_paid: boolean;
      order_number: string;
    }>("/api/admin/pos/collect", {
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
    setMessage(
      result.data?.fully_paid
        ? `${result.data.order_number} fully settled.`
        : `Collected ${formatMoney(result.data?.collected || 0)} · balance ${formatMoney(result.data?.balance_due || 0)}`
    );
    setCollectingId(null);
    setTick((n) => n + 1);
  };

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Store credit dues"
        description="Customers who took goods on credit or paid only part of the POS bill. Collect the balance here."
      />

      <form
        className="admin-toolbar"
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

      {data?.totals ? (
        <div
          className="admin-card-grid"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
        >
          <AdminPanel title="Total due">
            <b>{formatMoney(data.totals.outstanding)}</b>
          </AdminPanel>
          <AdminPanel title="Customers">
            <b>{data.totals.customer_count}</b>
          </AdminPanel>
          <AdminPanel title="Open bills">
            <b>{data.totals.bill_count}</b>
          </AdminPanel>
        </div>
      ) : null}

      <AdminPanel title="Who should pay">
        {loading ? <AdminLoading /> : null}
        {!loading && !(data?.customers || []).length ? (
          <AdminEmpty
            title="No credit dues"
            body="When a POS bill is saved on credit, the customer balance appears here."
          />
        ) : null}

        {(data?.customers || []).map((group) => (
          <div key={group.key} className="pos-dues-customer" style={{ marginBottom: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "baseline",
                marginBottom: 8
              }}
            >
              <div>
                <strong>{group.customer_name}</strong>
                <p className="muted" style={{ margin: "2px 0 0" }}>
                  {group.customer_phone || "—"} · {group.bill_count} bill
                  {group.bill_count === 1 ? "" : "s"}
                </p>
              </div>
              <strong style={{ color: "#9b3b2e" }}>
                Should give {formatMoney(group.outstanding_amount)}
              </strong>
            </div>

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
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 6,
                              alignItems: "center"
                            }}
                          >
                            <input
                              type="number"
                              min={0.01}
                              step="0.01"
                              max={bill.outstanding_amount}
                              value={collectAmount}
                              onChange={(e) => setCollectAmount(e.target.value)}
                              style={{ width: 100 }}
                              disabled={busy}
                            />
                            <select
                              value={collectMethod}
                              onChange={(e) =>
                                setCollectMethod(e.target.value as "cash" | "upi" | "card")
                              }
                              disabled={busy}
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
          </div>
        ))}
      </AdminPanel>
    </div>
  );
}
