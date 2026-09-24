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

type Payload = {
  rows: Array<{
    entry_id: string;
    entry_no: string;
    supplier_name: string | null;
    invoice_date: string;
    invoice_amount: number;
    paid_amount: number;
    outstanding_amount: number;
    reference_no: string | null;
    days_overdue: number;
    ageing: string;
    status_label: string;
    status: string;
  }>;
  totals: {
    outstanding: number;
    count: number;
    ageing: Record<string, number>;
  };
};

export default function FinancePayablesPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (submittedQ) params.set("q", submittedQ);
    const qs = params.toString();
    return `/api/admin/finance/payables${qs ? `?${qs}` : ""}`;
  }, [from, to, submittedQ]);

  const { data, error, loading, reload } = useAdminQuery<Payload>(path);

  const markPaid = async (entryId: string) => {
    setBusyId(entryId);
    setMessage("");
    const result = await adminFetch(`/api/admin/finance/entries/${entryId}`, {
      method: "PATCH",
      json: { status: "cleared", payment_method: "bank" }
    });
    setBusyId(null);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Supplier bill marked paid — payable reduced and cashbook updated.");
    await reload();
  };

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Supplier dues"
        description="Open purchase bills from stock inward (GRN). Mark paid when you settle the supplier — inventory itself is unchanged."
      />
      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedQ(q.trim());
        }}
      >
        <label>
          <span>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="admin-grow">
          <span>Search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bill / supplier" />
        </label>
        <button className="btn" type="submit">
          Apply
        </button>
      </form>

      {message ? <AdminAlert tone="ok">{message}</AdminAlert> : null}
      {error ? <AdminAlert>{error}</AdminAlert> : null}

      {data?.totals ? (
        <div className="admin-card-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
          <AdminPanel title="Outstanding">
            <b>{formatMoney(data.totals.outstanding)}</b>
          </AdminPanel>
          <AdminPanel title="Open bills">
            <b>{data.totals.count}</b>
          </AdminPanel>
          {Object.entries(data.totals.ageing || {}).map(([k, v]) => (
            <AdminPanel key={k} title={`${k} days`}>
              <b>{formatMoney(v)}</b>
            </AdminPanel>
          ))}
        </div>
      ) : null}

      <AdminPanel title="Payable register">
        {loading ? <AdminLoading /> : null}
        {!loading && !(data?.rows || []).length ? (
          <AdminEmpty title="No purchase bills" body="Run Sync on Finance dashboard after GRN inward." />
        ) : null}
        {(data?.rows || []).length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bill</th>
                  <th>Supplier</th>
                  <th>Amount</th>
                  <th>Outstanding</th>
                  <th>Age</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows || []).map((row) => (
                  <tr key={row.entry_id}>
                    <td>{formatDate(row.invoice_date)}</td>
                    <td>
                      <b>{row.reference_no || row.entry_no}</b>
                      <div className="muted admin-sub">{row.entry_no}</div>
                    </td>
                    <td>{row.supplier_name || "—"}</td>
                    <td>{formatMoney(row.invoice_amount)}</td>
                    <td>
                      <b>{formatMoney(row.outstanding_amount)}</b>
                    </td>
                    <td>
                      {row.days_overdue}d · {row.ageing}
                    </td>
                    <td>
                      <AdminBadge tone={statusTone(row.status)}>
                        {row.status_label}
                      </AdminBadge>
                    </td>
                    <td>
                      {row.status === "pending" ? (
                        <button
                          type="button"
                          className="admin-action-btn"
                          disabled={busyId === row.entry_id}
                          onClick={() => void markPaid(row.entry_id)}
                        >
                          Mark paid
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </AdminPanel>
    </div>
  );
}
