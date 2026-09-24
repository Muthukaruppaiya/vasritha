"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  LineChart,
  RefreshCw,
  Wallet
} from "lucide-react";
import {
  AdminAlert,
  AdminBarList,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  AdminSparkline
} from "../../../components/admin/admin-ui";
import { adminFetch, formatMoney } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";
import { PERIOD_OPTIONS } from "../../../lib/finance-period";
import { OPS_PLATFORM_NAME } from "../../../lib/platform";

type DashboardPayload = {
  sync?: { inserted?: number };
  period: { from: string; to: string; key: string };
  cards: {
    today_sales: number;
    monthly_sales: number;
    total_purchases: number;
    total_expenses: number;
    gross_profit: number;
    net_profit: number;
    customer_outstanding: number;
    supplier_outstanding: number;
    cash_balance: number;
    bank_upi_balance: number;
    open_customer_bills: number;
    open_supplier_bills: number;
  };
  charts: {
    sales_trend: Array<{ label: string; total: number }>;
    revenue_vs_expense: Array<{ label: string; value: number }>;
  };
};

export default function FinanceDashboardPage() {
  const [period, setPeriod] = useState("this_month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  const path = useMemo(() => {
    const params = new URLSearchParams({ period });
    if (period === "custom") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    return `/api/admin/finance/dashboard?${params.toString()}`;
  }, [period, from, to]);

  const { data, error, loading, reload } = useAdminQuery<DashboardPayload>(path);
  const cards = data?.cards;

  const syncAll = async () => {
    setSyncing(true);
    setMessage("");
    const result = await adminFetch<{ inserted?: number }>("/api/admin/finance/sync", {
      method: "POST"
    });
    setSyncing(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(`Synced ${result.data?.inserted ?? 0} shop transaction(s) from sales, purchases and refunds.`);
    await reload();
  };

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Boutique finance"
        description="Simple shop money view — sales, purchases, expenses, dues and cash. Built on your existing orders and billing."
        actions={
          <button type="button" className="btn" disabled={syncing} onClick={() => void syncAll()}>
            <RefreshCw size={15} />
            {syncing ? "Syncing…" : "Sync from sales"}
          </button>
        }
      />

      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          void reload();
        }}
      >
        <label>
          <span>Period</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        {period === "custom" ? (
          <>
            <label>
              <span>From</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              <span>To</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        ) : null}
        <button className="btn" type="submit">
          Apply
        </button>
      </form>

      {message ? <AdminAlert tone="ok">{message}</AdminAlert> : null}
      {error ? <AdminAlert>{error}</AdminAlert> : null}
      {loading ? <AdminLoading /> : null}

      {cards ? (
        <div className="admin-card-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {[
            ["Today's sales", cards.today_sales],
            ["Monthly sales", cards.monthly_sales],
            ["Purchases", cards.total_purchases],
            ["Expenses", cards.total_expenses],
            ["Gross profit", cards.gross_profit],
            ["Net profit", cards.net_profit],
            ["Customer dues", cards.customer_outstanding],
            ["Supplier dues", cards.supplier_outstanding],
            ["Cash in hand", cards.cash_balance],
            ["Bank / UPI wallet", cards.bank_upi_balance]
          ].map(([label, value]) => (
            <AdminPanel key={String(label)} title={String(label)}>
              <p style={{ fontSize: "1.25rem", margin: 0 }}>
                <b>{formatMoney(Number(value))}</b>
              </p>
            </AdminPanel>
          ))}
        </div>
      ) : null}

      {data?.charts ? (
        <div className="admin-card-grid">
          <AdminPanel title="Sales trend">
            {(data.charts.sales_trend || []).length ? (
              <AdminSparkline points={data.charts.sales_trend} />
            ) : (
              <AdminEmpty title="No paid sales in range" body="Complete a POS or online sale, then sync." />
            )}
          </AdminPanel>
          <AdminPanel title="Sales vs costs">
            <AdminBarList
              tone="brand"
              items={(data.charts.revenue_vs_expense || []).map((i) => ({
                label: i.label,
                value: i.value
              }))}
            />
          </AdminPanel>
        </div>
      ) : null}

      <AdminPanel title="Quick links">
        <div className="admin-card-grid">
          <Link className="admin-soft-card" href="/admin/finance/incoming">
            <ArrowDownLeft size={18} />
            <strong>Sales receipts</strong>
            <p className="muted">Online + POS payments synced into finance.</p>
          </Link>
          <Link className="admin-soft-card" href="/admin/finance/receivables">
            <Wallet size={18} />
            <strong>Customer dues</strong>
            <p className="muted">{cards?.open_customer_bills ?? 0} open bill(s).</p>
          </Link>
          <Link className="admin-soft-card" href="/admin/finance/payables">
            <ArrowUpRight size={18} />
            <strong>Supplier dues</strong>
            <p className="muted">{cards?.open_supplier_bills ?? 0} open purchase(s).</p>
          </Link>
          <Link className="admin-soft-card" href="/admin/finance/expenses">
            <ArrowUpRight size={18} />
            <strong>Shop expenses</strong>
            <p className="muted">Rent, salary, packaging, marketing…</p>
          </Link>
          <Link className="admin-soft-card" href="/admin/finance/cash-bank">
            <Landmark size={18} />
            <strong>Cash &amp; Bank</strong>
            <p className="muted">Opening balance and daily wallet totals.</p>
          </Link>
          <Link className="admin-soft-card" href="/admin/finance/pnl">
            <LineChart size={18} />
            <strong>Profit &amp; Loss</strong>
            <p className="muted">Simple shop P&amp;L for the period.</p>
          </Link>
          <Link className="admin-soft-card" href="/admin/finance/reports">
            <LineChart size={18} />
            <strong>Reports</strong>
            <p className="muted">Daily sales, payments, products, refunds.</p>
          </Link>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          Period: {data?.period.from || "—"} → {data?.period.to || "—"}
        </p>
      </AdminPanel>
    </div>
  );
}
