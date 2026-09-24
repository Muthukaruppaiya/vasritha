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
import { formatDate, formatMoney } from "../../../../lib/admin-api";
import { useAdminQuery } from "../../../../hooks/use-admin-query";
import { CATEGORY_LABELS } from "../../../../lib/finance-labels";
import { OPS_PLATFORM_NAME } from "../../../../lib/platform";

type Entry = {
  id: string;
  entry_no: string;
  direction: string;
  category: string;
  amount: string | number;
  payment_method: string;
  status: string;
  entry_date: string;
  counterparty_name: string | null;
  reference_no: string | null;
  reference_type?: string | null;
  notes: string | null;
  order_number?: string | null;
};

export default function FinanceTransactionsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [direction, setDirection] = useState("all");
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");

  const path = useMemo(() => {
    const params = new URLSearchParams({ limit: "300" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (direction !== "all") params.set("direction", direction);
    if (submittedQ) params.set("q", submittedQ);
    return `/api/admin/finance/entries?${params.toString()}`;
  }, [from, to, direction, submittedQ]);

  const { data, error, loading } = useAdminQuery<Entry[]>(path);

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Transactions / Day book"
        description="All finance cashbook entries with source references (payment, GRN, return, manual)."
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
        <label>
          <span>Flow</span>
          <select value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="all">All</option>
            <option value="in">Incoming</option>
            <option value="out">Outgoing</option>
          </select>
        </label>
        <label className="admin-grow">
          <span>Search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Entry / party / ref" />
        </label>
        <button className="btn" type="submit">
          Apply
        </button>
      </form>
      {error ? <AdminAlert>{error}</AdminAlert> : null}
      <AdminPanel title="Register">
        {loading ? <AdminLoading /> : null}
        {!loading && !(data || []).length ? (
          <AdminEmpty title="No transactions" body="Sync sales/purchases or add manual entries." />
        ) : null}
        {(data || []).length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Entry</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Party</th>
                  <th>Reference</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Debit</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.entry_date)}</td>
                    <td>
                      <b>{row.entry_no}</b>
                    </td>
                    <td>{row.direction === "in" ? "Receipt" : "Payment"}</td>
                    <td>{CATEGORY_LABELS[row.category] || row.category}</td>
                    <td>{row.counterparty_name || "—"}</td>
                    <td>
                      {row.order_number || row.reference_no || row.reference_type || "—"}
                    </td>
                    <td>{row.payment_method}</td>
                    <td>
                      <AdminBadge tone={statusTone(row.status)}>{row.status}</AdminBadge>
                    </td>
                    <td>{row.direction === "out" ? formatMoney(row.amount) : "—"}</td>
                    <td>{row.direction === "in" ? formatMoney(row.amount) : "—"}</td>
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
