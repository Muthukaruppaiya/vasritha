"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, History, Search, Warehouse, X } from "lucide-react";
import {
  AdminAlert,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../../components/admin/admin-ui";
import {
  AdminPagination,
  useAdminPageSize
} from "../../../../components/admin/admin-pagination";
import { getAdminUser } from "../../../../lib/admin-api";
import { useAdminQuery } from "../../../../hooks/use-admin-query";

type LedgerRow = {
  id: string;
  created_at: string;
  type: string;
  quantity: number;
  signed_qty: number;
  note: string | null;
  reference_type: string | null;
  reference_id: string | null;
  order_number: string | null;
  order_channel: string | null;
  grn_number: string | null;
  bill_no: string | null;
  supplier_name: string | null;
  return_number: string | null;
  variant_id: string;
  sku: string | null;
  variant_name: string | null;
  product_id: string;
  product_name: string;
  product_color: string | null;
  shop_name: string | null;
  created_by_name: string | null;
};

type LedgerData = {
  rows: LedgerRow[];
  total: number;
  totals: { in: number; out: number; net: number };
  product: {
    id: string;
    name: string;
    sku: string | null;
    color: string | null;
    on_hand: number;
  } | null;
  shopName: string | null;
};

const TYPE_OPTIONS = [
  { value: "", label: "All movements" },
  { value: "in", label: "Stock in (+)" },
  { value: "out", label: "Stock out (−)" },
  { value: "sale", label: "Sales" },
  { value: "purchase", label: "GRN inward" },
  { value: "return", label: "Returns / exchange in" },
  { value: "manual_adjustment", label: "Adjustments" },
  { value: "opening_stock", label: "Opening stock" }
];

function movementLabel(type: string) {
  const map: Record<string, string> = {
    purchase: "GRN inward",
    opening_stock: "Opening stock",
    manual_adjustment: "Adjustment",
    return: "Return / exchange in",
    sale: "Sale",
    transfer_in: "Transfer in",
    transfer_out: "Transfer out"
  };
  return map[type] || type;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function ReferenceCell({ row }: { row: LedgerRow }) {
  if (row.order_number) {
    return (
      <>
        <b>INV-{row.order_number}</b>
        <div className="muted admin-sub">
          {row.order_channel === "pos" ? "Store bill" : "Online order"}
        </div>
      </>
    );
  }
  if (row.grn_number) {
    return (
      <>
        <b>{row.grn_number}</b>
        <div className="muted admin-sub">
          {[row.bill_no ? `Bill ${row.bill_no}` : null, row.supplier_name]
            .filter(Boolean)
            .join(" · ") || "Goods receipt"}
        </div>
      </>
    );
  }
  if (row.return_number) {
    return (
      <>
        <b>{row.return_number}</b>
        <div className="muted admin-sub">Exchange / return</div>
      </>
    );
  }
  if (row.reference_type === "manual") return <span className="muted">Manual entry</span>;
  return <span className="muted">—</span>;
}

function StockLedgerPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const productFilter = searchParams.get("product") || "";
  const sessionShopId = getAdminUser()?.shopId || null;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useAdminPageSize(25);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, typeFilter, from, to, productFilter, pageSize]);

  const queryPath = useMemo(() => {
    const params = new URLSearchParams();
    if (productFilter) params.set("product", productFilter);
    if (sessionShopId) params.set("shopId", sessionShopId);
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (typeFilter) params.set("type", typeFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("limit", String(pageSize));
    params.set("offset", String(page * pageSize));
    return `/api/admin/inventory/ledger?${params.toString()}`;
  }, [productFilter, sessionShopId, debouncedSearch, typeFilter, from, to, page, pageSize]);

  const { data, loading, error } = useAdminQuery<LedgerData>(queryPath);
  const rows = data?.rows || [];
  const total = data?.total ?? 0;
  const product = data?.product || null;
  const hasFilters = Boolean(debouncedSearch || typeFilter || from || to);

  const setProduct = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("product", id);
    else params.delete("product");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Inventory"
        title="Stock ledger"
        description="Every stock movement — GRN inward, sales, returns and adjustments — with the invoice or GRN it came from."
        actions={
          <>
            <Link className="admin-icon-tip" href="/admin/inventory">
              <ArrowLeft size={16} strokeWidth={2} />
              <span>Back to inventory</span>
            </Link>
            <Link className="admin-icon-tip" href="/admin/inventory/grn/history">
              <History size={16} strokeWidth={2} />
              <span>GRN history</span>
            </Link>
          </>
        }
      />

      {productFilter ? (
        <AdminAlert tone="ok">
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <BookOpen size={15} />
            Ledger for <b>{product?.name || "selected product"}</b>
            {product?.sku ? <span className="muted">· {product.sku}</span> : null}
            {product ? (
              <span>
                · On hand now <b>{product.on_hand}</b>
              </span>
            ) : null}
            <button
              type="button"
              className="btn admin-ghost-btn"
              onClick={() => setProduct(null)}
              style={{ marginLeft: 8 }}
            >
              <X size={14} />
              Show all products
            </button>
          </span>
        </AdminAlert>
      ) : null}

      <div className="inv-summary">
        <article className="inv-summary-card">
          <Warehouse size={16} />
          <div>
            <span>Entries</span>
            <strong>{data ? total : "—"}</strong>
          </div>
        </article>
        <article className="inv-summary-card inv-summary-card--ok">
          <div>
            <span>Stock in</span>
            <strong>{data ? `+${data.totals.in}` : "—"}</strong>
          </div>
        </article>
        <article className="inv-summary-card inv-summary-card--danger">
          <div>
            <span>Stock out</span>
            <strong>{data ? `−${data.totals.out}` : "—"}</strong>
          </div>
        </article>
        <article className="inv-summary-card">
          <div>
            <span>Net change</span>
            <strong>
              {data ? `${data.totals.net > 0 ? "+" : data.totals.net < 0 ? "−" : ""}${Math.abs(data.totals.net)}` : "—"}
            </strong>
          </div>
        </article>
      </div>

      <AdminPanel title={productFilter ? "Item ledger" : "All movements"}>
        <div className="inv-filters">
          <label className="inv-search">
            <span>Search</span>
            <div className="admin-search-field">
              <Search size={15} aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Product, SKU, barcode, invoice / GRN no…"
              />
            </div>
          </label>
          <label>
            <span>Movement</span>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
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
        </div>

        {error ? <AdminAlert>{error}</AdminAlert> : null}
        {loading ? <AdminLoading /> : null}

        {!loading && !rows.length ? (
          <AdminEmpty
            title="No stock movements"
            body={
              hasFilters || productFilter
                ? "Nothing matches these filters. Try a wider date range or clear the search."
                : "Movements appear here after a GRN is approved, a sale is billed, or stock is adjusted."
            }
          />
        ) : null}

        {rows.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>Date &amp; time</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Reference</th>
                  <th>Shop</th>
                  <th>By</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.created_at)}</td>
                    <td>
                      {productFilter ? (
                        <b>{row.product_name}</b>
                      ) : (
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() => setProduct(row.product_id)}
                          title="Show ledger for this product"
                        >
                          <b>{row.product_name}</b>
                        </button>
                      )}
                      <div className="muted admin-sub">
                        {[row.sku, row.variant_name, row.product_color].filter(Boolean).join(" · ") ||
                          "—"}
                      </div>
                    </td>
                    <td>{movementLabel(row.type)}</td>
                    <td className={row.signed_qty < 0 ? "inv-qty-out" : "inv-qty-in"}>
                      {row.signed_qty > 0 ? "+" : row.signed_qty < 0 ? "−" : ""}
                      {Math.abs(row.signed_qty)}
                    </td>
                    <td>
                      <ReferenceCell row={row} />
                    </td>
                    <td>{row.shop_name || (row.order_channel === "online" ? "Online" : "—")}</td>
                    <td>{row.created_by_name || "—"}</td>
                    <td>{row.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <AdminPagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="entries"
            />
          </div>
        ) : null}
      </AdminPanel>
    </>
  );
}

export default function StockLedgerPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <StockLedgerPageInner />
    </Suspense>
  );
}
