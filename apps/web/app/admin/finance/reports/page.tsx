"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AdminAlert,
  AdminBarList,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../../components/admin/admin-ui";
import { formatDate, formatMoney } from "../../../../lib/admin-api";
import { useAdminQuery } from "../../../../hooks/use-admin-query";
import { OPS_PLATFORM_NAME } from "../../../../lib/platform";

const REPORTS = [
  { type: "sales", label: "Sales report" },
  { type: "purchases", label: "Purchase report" },
  { type: "expenses", label: "Expense report" },
  { type: "pnl", label: "Profit & Loss" },
  { type: "receivables", label: "Customer outstanding" },
  { type: "payables", label: "Supplier outstanding" },
  { type: "payments", label: "Payment report" },
  { type: "cashflow", label: "Cash flow" },
  { type: "payment_methods", label: "Sales by payment method" },
  { type: "products", label: "Sales by product / category" },
  { type: "returns", label: "Returns & refunds" },
  { type: "tax", label: "Tax on sales (from billing)" }
] as const;

function moneyish(key: string, value: unknown) {
  if (typeof value === "number") {
    if (
      key.includes("qty") ||
      key.includes("count") ||
      key === "orders" ||
      key === "days_overdue"
    ) {
      return String(value);
    }
    return formatMoney(value);
  }
  if (key.includes("date") || key === "date" || key === "invoice_date") {
    return formatDate(String(value ?? ""));
  }
  return String(value ?? "—");
}

export default function FinanceReportsHubPage() {
  const [type, setType] = useState<(typeof REPORTS)[number]["type"]>("sales");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const path = useMemo(() => {
    const params = new URLSearchParams({ type });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/admin/finance/reports?${params.toString()}`;
  }, [type, from, to]);

  const { data, error, loading, reload } = useAdminQuery<Record<string, unknown>>(path);
  const rows = (data?.rows as Array<Record<string, unknown>> | undefined) || [];

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Boutique finance reports"
        description="Quick finance snapshots. For full filterable / exportable boutique reports, use the Reports module."
        actions={
          <Link className="btn" href="/admin/reports">
            Open Reports module
          </Link>
        }
      />

      <div className="admin-card-grid">
        <Link className="admin-soft-card" href="/admin/finance/pnl">
          <strong>Profit &amp; Loss</strong>
          <p className="muted">Full P&amp;L screen with category breakdown.</p>
        </Link>
        <Link className="admin-soft-card" href="/admin/finance/receivables">
          <strong>Customer dues</strong>
          <p className="muted">Unpaid / overdue boutique bills.</p>
        </Link>
        <Link className="admin-soft-card" href="/admin/finance/payables">
          <strong>Supplier dues</strong>
          <p className="muted">Open GRN purchase bills.</p>
        </Link>
      </div>

      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          void reload();
        }}
      >
        <label>
          <span>Report</span>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {REPORTS.map((r) => (
              <option key={r.type} value={r.type}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="btn" type="submit">
          Run
        </button>
      </form>

      {error ? <AdminAlert>{error}</AdminAlert> : null}
      {loading ? <AdminLoading /> : null}

      {data && type === "cashflow" ? (
        <AdminPanel title="Cash flow">
          <p>
            Opening: <b>{formatMoney(Number(data.opening_balance || 0))}</b>
          </p>
          <p>
            Money in:{" "}
            <b>{formatMoney(Number((data.inflows as { total?: number } | undefined)?.total || 0))}</b>
          </p>
          <p>
            Money out:{" "}
            <b>{formatMoney(Number((data.outflows as { total?: number } | undefined)?.total || 0))}</b>
          </p>
          <p>
            Closing: <b>{formatMoney(Number(data.closing_balance || 0))}</b>
          </p>
        </AdminPanel>
      ) : null}

      {data && type === "pnl" ? (
        <AdminPanel title="Profit & Loss snapshot">
          <p>
            Sales: <b>{formatMoney(Number(data.revenue || 0))}</b>
          </p>
          <p>
            Purchases: <b>{formatMoney(Number(data.cogs || 0))}</b>
          </p>
          <p>
            Expenses: <b>{formatMoney(Number(data.operating_expenses || 0))}</b>
          </p>
          <p>
            Gross: <b>{formatMoney(Number(data.gross_profit || 0))}</b> · Net:{" "}
            <b>{formatMoney(Number(data.net_profit || 0))}</b>
          </p>
          <p className="muted">
            <Link href="/admin/finance/pnl">Open full P&amp;L →</Link>
          </p>
        </AdminPanel>
      ) : null}

      {data && type === "tax" ? (
        <AdminPanel title="Tax on sales">
          <p>
            Tax collected: <b>{formatMoney(Number(data.tax_collected_on_sales || 0))}</b>
          </p>
          <p className="muted">{String(data.note || "")}</p>
        </AdminPanel>
      ) : null}

      {data && type === "returns" ? (
        <AdminPanel title="Returns & refunds">
          <p>
            Refunded total: <b>{formatMoney(Number(data.total_refunded || 0))}</b>
          </p>
        </AdminPanel>
      ) : null}

      {data && type === "products" && Array.isArray(data.by_category) ? (
        <AdminPanel title="By category">
          <AdminBarList
            tone="brand"
            items={(data.by_category as Array<{ category: string; amount: number }>).map((r) => ({
              label: r.category,
              value: r.amount
            }))}
          />
        </AdminPanel>
      ) : null}

      {data && type === "expenses" && Array.isArray(data.by_category) ? (
        <AdminPanel title="Expense by category">
          <AdminBarList
            tone="brand"
            items={(data.by_category as Array<{ category: string; amount: number }>).map((r) => ({
              label: r.category,
              value: r.amount
            }))}
          />
        </AdminPanel>
      ) : null}

      {data && type !== "cashflow" && type !== "pnl" && type !== "tax" ? (
        <AdminPanel title={REPORTS.find((r) => r.type === type)?.label || "Report"}>
          {!rows.length ? (
            <AdminEmpty title="No rows" body="Try a wider date range or sync sales first." />
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--zebra">
                <thead>
                  <tr>
                    {Object.keys(rows[0] || {}).map((key) => (
                      <th key={key}>{key.replace(/_/g, " ")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx}>
                      {Object.entries(row).map(([key, value]) => (
                        <td key={key}>{moneyish(key, value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminPanel>
      ) : null}
    </div>
  );
}
