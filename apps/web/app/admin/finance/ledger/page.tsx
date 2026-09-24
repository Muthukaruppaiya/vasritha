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

type LedgerRow = {
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
  signed_amount: number;
  running_balance: number;
};

export default function FinanceLedgerPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (submittedQ) params.set("q", submittedQ);
    const qs = params.toString();
    return `/api/admin/finance/ledger${qs ? `?${qs}` : ""}`;
  }, [from, to, submittedQ]);

  const { data, error, loading, reload } = useAdminQuery<LedgerRow[]>(path);

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Ledger"
        description="Cleared cashbook with running balance (incoming minus outgoing)."
      />

      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedQ(q.trim());
          void reload();
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
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Entry, party, reference…"
          />
        </label>
        <button className="btn" type="submit">
          Apply
        </button>
      </form>

      {error ? <AdminAlert>{error}</AdminAlert> : null}

      <AdminPanel title="Cashbook ledger">
        {loading ? <AdminLoading /> : null}
        {!loading && !(data || []).length ? (
          <AdminEmpty title="No cleared entries" body="Record or sync payments first." />
        ) : null}
        {(data || []).length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Entry</th>
                  <th>Particulars</th>
                  <th>Method</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.entry_date)}</td>
                    <td>
                      <b>{row.entry_no}</b>
                      <div className="muted admin-sub">
                        <AdminBadge tone={statusTone(row.status)}>{row.status}</AdminBadge>
                      </div>
                    </td>
                    <td>
                      <div>{row.counterparty_name || CATEGORY_LABELS[row.category] || row.category}</div>
                      <div className="muted admin-sub">
                        {CATEGORY_LABELS[row.category] || row.category}
                        {row.reference_no ? ` · ${row.reference_no}` : ""}
                      </div>
                    </td>
                    <td>{row.payment_method}</td>
                    <td>{row.direction === "in" ? formatMoney(row.amount) : "—"}</td>
                    <td>{row.direction === "out" ? formatMoney(row.amount) : "—"}</td>
                    <td>
                      <b>{formatMoney(row.running_balance)}</b>
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
