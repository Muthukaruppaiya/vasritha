"use client";

import Link from "next/link";
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
import { OPS_PLATFORM_NAME } from "../../../../lib/platform";

type Payload = {
  rows: Array<{
    order_id: string;
    order_number: string;
    customer_name: string | null;
    invoice_date: string;
    invoice_amount: number;
    paid_amount: number;
    outstanding_amount: number;
    days_overdue: number;
    ageing: string;
    status_label: string;
  }>;
  totals: {
    outstanding: number;
    count: number;
    ageing: Record<string, number>;
  };
};

export default function FinanceReceivablesPage() {
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
    return `/api/admin/finance/receivables${qs ? `?${qs}` : ""}`;
  }, [from, to, submittedQ]);

  const { data, error, loading } = useAdminQuery<Payload>(path);

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Customer dues"
        description="Unpaid boutique bills from e-commerce/POS. Collect payment in Billing or online checkout — this list stays in sync with orders."
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
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order / customer" />
        </label>
        <button className="btn" type="submit">
          Apply
        </button>
      </form>

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

      <AdminPanel title="Receivable register">
        {loading ? <AdminLoading /> : null}
        {!loading && !(data?.rows || []).length ? (
          <AdminEmpty title="No open receivables" body="All listed orders are paid or cancelled." />
        ) : null}
        {(data?.rows || []).length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Overdue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows || []).map((row) => (
                  <tr key={row.order_id}>
                    <td>{formatDate(row.invoice_date)}</td>
                    <td>
                      <Link href={`/admin/orders?q=${encodeURIComponent(row.order_number)}`}>
                        <b>{row.order_number}</b>
                      </Link>
                    </td>
                    <td>{row.customer_name || "—"}</td>
                    <td>{formatMoney(row.invoice_amount)}</td>
                    <td>{formatMoney(row.paid_amount)}</td>
                    <td>
                      <b>{formatMoney(row.outstanding_amount)}</b>
                    </td>
                    <td>
                      {row.days_overdue}d · {row.ageing}
                    </td>
                    <td>
                      <AdminBadge tone={statusTone(row.status_label.toLowerCase())}>
                        {row.status_label}
                      </AdminBadge>
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
