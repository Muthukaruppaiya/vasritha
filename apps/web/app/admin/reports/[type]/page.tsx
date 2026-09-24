"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  AdminAlert,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../../components/admin/admin-ui";
import { formatDate, formatMoney, getAdminToken } from "../../../../lib/admin-api";
import { useAdminQuery } from "../../../../hooks/use-admin-query";
import { getReportMeta } from "../../../../lib/report-catalog";
import { OPS_PLATFORM_NAME } from "../../../../lib/platform";

type Column = { key: string; label: string; format?: "money" | "date" | "number" | "text" };

type ReportPayload = {
  type: string;
  title: string;
  from: string | null;
  to: string | null;
  columns: Column[];
  rows: Array<Record<string, unknown>>;
  summary: Record<string, number | string>;
  pagination: { page: number; pageSize: number; total: number; total_pages: number };
  notes?: string[];
  links?: Array<{ label: string; href: string }>;
};

function cellValue(col: Column, value: unknown) {
  if (value == null || value === "") return "—";
  if (col.format === "money") return formatMoney(Number(value));
  if (col.format === "date") return formatDate(String(value));
  if (col.format === "number") return String(value);
  return String(value);
}

function summaryLabel(key: string) {
  return key.replace(/^cat_/, "").replace(/_/g, " ");
}

export default function ReportRunnerPage() {
  const params = useParams<{ type: string }>();
  const type = String(params.type || "");
  const meta = getReportMeta(type);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [customer, setCustomer] = useState("");
  const [product, setProduct] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [stockStatus, setStockStatus] = useState("all");
  const [applied, setApplied] = useState({
    from: "",
    to: "",
    q: "",
    customer: "",
    product: "",
    category: "",
    payment_method: "",
    order_status: "",
    payment_status: "",
    stock_status: "all",
    page: 1
  });

  const path = useMemo(() => {
    if (!meta) return null;
    const p = new URLSearchParams({ type, page: String(applied.page), pageSize: "50" });
    if (applied.from) p.set("from", applied.from);
    if (applied.to) p.set("to", applied.to);
    if (applied.q) p.set("q", applied.q);
    if (applied.customer) p.set("customer", applied.customer);
    if (applied.product) p.set("product", applied.product);
    if (applied.category) p.set("category", applied.category);
    if (applied.payment_method) p.set("payment_method", applied.payment_method);
    if (applied.order_status) p.set("order_status", applied.order_status);
    if (applied.payment_status) p.set("payment_status", applied.payment_status);
    if (applied.stock_status && applied.stock_status !== "all") {
      p.set("stock_status", applied.stock_status);
    }
    return `/api/admin/reports?${p.toString()}`;
  }, [meta, type, applied]);

  const { data, error, loading, reload } = useAdminQuery<ReportPayload>(path);

  if (!meta) {
    return (
      <div className="admin-stack">
        <AdminPageHeader title="Report not found" description="Unknown report type." />
        <Link href="/admin/reports" className="btn">
          Back to reports
        </Link>
      </div>
    );
  }

  const showDates = type !== "inventory";
  const showCustomer = ["sales", "customers", "customer_outstanding", "orders"].includes(type);
  const showProduct = ["sales", "product_sales", "inventory"].includes(type);
  const showCategory = ["sales", "product_sales", "category_sales", "inventory"].includes(type);
  const showPayMethod = ["sales", "orders", "payments"].includes(type);
  const showOrderStatus = ["sales", "orders"].includes(type);
  const showPaymentStatus = ["sales", "orders"].includes(type);
  const showStock = type === "inventory";

  const exportCsv = async () => {
    const p = new URLSearchParams({ type, format: "csv" });
    if (applied.from) p.set("from", applied.from);
    if (applied.to) p.set("to", applied.to);
    if (applied.q) p.set("q", applied.q);
    if (applied.customer) p.set("customer", applied.customer);
    if (applied.product) p.set("product", applied.product);
    if (applied.category) p.set("category", applied.category);
    if (applied.payment_method) p.set("payment_method", applied.payment_method);
    if (applied.order_status) p.set("order_status", applied.order_status);
    if (applied.payment_status) p.set("payment_status", applied.payment_status);
    if (applied.stock_status && applied.stock_status !== "all") {
      p.set("stock_status", applied.stock_status);
    }
    const token = getAdminToken();
    const res = await fetch(`/api/admin/reports?${p.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      alert("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-stack report-print-root">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title={meta.label}
        description={meta.description}
        actions={
          <div className="admin-page-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn btn-ghost" href="/admin/reports">
              All reports
            </Link>
            {"reuseHref" in meta && meta.reuseHref ? (
              <Link className="btn btn-ghost" href={meta.reuseHref}>
                Open in Finance
              </Link>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={() => void exportCsv()}>
              Export CSV
            </button>
            <button type="button" className="btn" onClick={() => window.print()}>
              Print
            </button>
          </div>
        }
      />

      <form
        className="admin-toolbar no-print"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({
            from,
            to,
            q: q.trim(),
            customer: customer.trim(),
            product: product.trim(),
            category: category.trim(),
            payment_method: paymentMethod.trim(),
            order_status: orderStatus.trim(),
            payment_status: paymentStatus.trim(),
            stock_status: stockStatus,
            page: 1
          });
        }}
      >
        {showDates ? (
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
        <label className="admin-grow">
          <span>Search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
        </label>
        {showCustomer ? (
          <label>
            <span>Customer</span>
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </label>
        ) : null}
        {showProduct ? (
          <label>
            <span>Product</span>
            <input value={product} onChange={(e) => setProduct(e.target.value)} />
          </label>
        ) : null}
        {showCategory ? (
          <label>
            <span>Category</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
        ) : null}
        {showPayMethod ? (
          <label>
            <span>Payment method</span>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="">All</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="razorpay">Online</option>
              <option value="bank">Bank</option>
              <option value="other">Other</option>
            </select>
          </label>
        ) : null}
        {showOrderStatus ? (
          <label>
            <span>Order status</span>
            <select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        ) : null}
        {showPaymentStatus ? (
          <label>
            <span>Payment status</span>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </label>
        ) : null}
        {showStock ? (
          <label>
            <span>Stock</span>
            <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="in">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </label>
        ) : null}
        <button className="btn" type="submit">
          Run
        </button>
      </form>

      {error ? <AdminAlert>{error}</AdminAlert> : null}
      {loading ? <AdminLoading /> : null}

      {data?.summary ? (
        <div
          className="admin-card-grid"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
        >
          {Object.entries(data.summary)
            .filter(([k]) => !k.startsWith("cat_"))
            .slice(0, 8)
            .map(([key, value]) => (
              <AdminPanel key={key} title={summaryLabel(key)}>
                <b>
                  {typeof value === "number" &&
                  (key.includes("amount") ||
                    key.includes("sales") ||
                    key.includes("value") ||
                    key.includes("paid") ||
                    key.includes("outstanding") ||
                    key.includes("discount") ||
                    key.includes("tax") ||
                    key.includes("refund") ||
                    key.includes("profit") ||
                    key.includes("expense") ||
                    key.includes("cost") ||
                    key === "gross_amount" ||
                    key === "net_amount" ||
                    key === "total")
                    ? formatMoney(value)
                    : String(value)}
                </b>
              </AdminPanel>
            ))}
        </div>
      ) : null}

      {data?.notes?.length ? (
        <p className="muted no-print">{data.notes.join(" · ")}</p>
      ) : null}

      {data?.links?.length ? (
        <p className="no-print">
          {data.links.map((l) => (
            <Link key={l.href} href={l.href} style={{ marginRight: 12 }}>
              {l.label} →
            </Link>
          ))}
        </p>
      ) : null}

      <AdminPanel
        title={data?.title || meta.label}
        actions={
          data?.pagination ? (
            <span className="muted no-print">
              {data.pagination.total} rows · page {data.pagination.page}/
              {data.pagination.total_pages}
            </span>
          ) : null
        }
      >
        {!data?.rows?.length && !loading ? (
          <AdminEmpty title="No rows" body="Try a wider date range or clear filters." />
        ) : data?.rows?.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  {data.columns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, idx) => (
                  <tr key={idx}>
                    {data.columns.map((col) => (
                      <td key={col.key}>{cellValue(col, row[col.key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </AdminPanel>

      {data?.pagination && data.pagination.total_pages > 1 ? (
        <div className="admin-toolbar no-print" style={{ justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={applied.page <= 1}
            onClick={() => {
              const next = Math.max(1, applied.page - 1);
              setApplied((a) => ({ ...a, page: next }));
            }}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={applied.page >= data.pagination.total_pages}
            onClick={() => {
              const next = applied.page + 1;
              setApplied((a) => ({ ...a, page: next }));
            }}
          >
            Next
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void reload()}>
            Refresh
          </button>
        </div>
      ) : null}
    </div>
  );
}
