"use client";

import { useMemo, useState } from "react";
import {
  AdminAlert,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../../components/admin/admin-ui";
import { formatMoney } from "../../../../lib/admin-api";
import { useAdminQuery } from "../../../../hooks/use-admin-query";
import { OPS_PLATFORM_NAME } from "../../../../lib/platform";

type PnL = {
  from: string;
  to: string;
  revenue: number;
  other_income: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  net_profit: number;
  by_category: Array<{ category: string; label: string; direction: string; total: number }>;
  incoming_total: number;
  outgoing_total: number;
};

export default function FinancePnLPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return `/api/admin/finance/pnl${qs ? `?${qs}` : ""}`;
  }, [from, to]);

  const { data, error, loading, reload } = useAdminQuery<PnL>(path);

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Profit & Loss"
        description="Simple boutique P&L: sales receipts minus purchases and shop expenses for the selected dates."
      />

      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
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
        <button className="btn" type="submit">
          Run statement
        </button>
      </form>

      {error ? <AdminAlert>{error}</AdminAlert> : null}
      {loading ? <AdminLoading /> : null}

      {data ? (
        <>
          <p className="muted">
            Statement period: <b>{data.from}</b> → <b>{data.to}</b>
          </p>
          <div className="admin-card-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            <AdminPanel title="Sales revenue">
              <b style={{ fontSize: "1.35rem" }}>{formatMoney(data.revenue)}</b>
            </AdminPanel>
            <AdminPanel title="Other income">
              <b style={{ fontSize: "1.35rem" }}>{formatMoney(data.other_income)}</b>
            </AdminPanel>
            <AdminPanel title="Purchases (COGS)">
              <b style={{ fontSize: "1.35rem" }}>{formatMoney(data.cogs)}</b>
            </AdminPanel>
            <AdminPanel title="Gross profit">
              <b style={{ fontSize: "1.35rem" }}>{formatMoney(data.gross_profit)}</b>
            </AdminPanel>
            <AdminPanel title="Operating expenses">
              <b style={{ fontSize: "1.35rem" }}>{formatMoney(data.operating_expenses)}</b>
            </AdminPanel>
            <AdminPanel title="Net profit">
              <b style={{ fontSize: "1.35rem" }}>{formatMoney(data.net_profit)}</b>
            </AdminPanel>
          </div>

          <AdminPanel title="Category breakdown">
            {!data.by_category.length ? (
              <AdminEmpty title="No cleared entries in this period" />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Flow</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_category.map((row) => (
                      <tr key={`${row.direction}-${row.category}`}>
                        <td>{row.label}</td>
                        <td>{row.direction === "in" ? "Income" : "Outflow"}</td>
                        <td>{formatMoney(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminPanel>
        </>
      ) : null}
    </div>
  );
}
