"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  CheckSquare,
  ClipboardCheck,
  Package,
  Printer,
  RefreshCw,
  Search,
  Square
} from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../components/admin/admin-ui";
import { AdminPagination, useAdminPageSize } from "../../../components/admin/admin-pagination";
import { adminFetch, formatDate, formatMoney } from "../../../lib/admin-api";
import {
  LABEL_LAYOUT_OPTIONS,
  layoutToLabelSize,
  printProductStickers,
  type LabelLayout
} from "../../../lib/print-stickers";
import { useAdminQuery } from "../../../hooks/use-admin-query";

const LABEL_LAYOUT_KEY = "vasritha_label_layout";

function readStoredLayout(): LabelLayout {
  if (typeof window === "undefined") return "set2";
  const raw = window.localStorage.getItem(LABEL_LAYOUT_KEY);
  return raw === "set3" ? "set3" : "set2";
}

type BarcodeItem = {
  id: string;
  barcode: string;
  unit_code: string;
  seq: number;
  tag: string;
  label_printed: boolean;
  product_id: string;
  product_name: string;
  short_name?: string | null;
  sku: string | null;
  slug?: string | null;
  price: string;
  color: string | null;
  variant_name?: string | null;
  hsn_code?: string | null;
  label_size: "accessory" | "dress" | null;
  compare_at_price: string | null;
  category_name: string | null;
  subcategory_name?: string | null;
  date_added: string;
};

type BarcodeData = {
  items: BarcodeItem[];
  summary: { total: number; unprinted: number; products: number };
};

function BarcodesPageInner() {
  const searchParams = useSearchParams();
  const productFilter = searchParams.get("product") || "";
  const labelParam = searchParams.get("label");
  const [search, setSearch] = useState("");
  const [unprintedOnly, setUnprintedOnly] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [addedFilter, setAddedFilter] = useState("");
  const [labelLayout, setLabelLayout] = useState<LabelLayout>(() => {
    if (labelParam === "set3" || labelParam === "accessory") return "set3";
    if (labelParam === "set2" || labelParam === "dress") return "set2";
    return readStoredLayout();
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useAdminPageSize();

  useEffect(() => {
    if (labelParam === "set3" || labelParam === "accessory") setLabelLayout("set3");
    else if (labelParam === "set2" || labelParam === "dress") setLabelLayout("set2");
  }, [labelParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LABEL_LAYOUT_KEY, labelLayout);
  }, [labelLayout]);

  const queryPath = useMemo(() => {
    const params = new URLSearchParams();
    if (unprintedOnly) params.set("unprinted", "1");
    else params.set("unprinted", "0");
    if (search.trim()) params.set("q", search.trim());
    if (productFilter) params.set("product", productFilter);
    if (categoryFilter) params.set("categoryId", categoryFilter);
    if (subcategoryFilter) params.set("subcategoryId", subcategoryFilter);
    if (addedFilter) params.set("addedDays", addedFilter);
    return `/api/admin/barcodes?${params.toString()}`;
  }, [unprintedOnly, search, productFilter, categoryFilter, subcategoryFilter, addedFilter]);

  const { data, loading, error, reload } = useAdminQuery<BarcodeData>(queryPath);
  const { data: categories } = useAdminQuery<
    Array<{
      id: string;
      name: string;
      subcategories?: Array<{ id: string; name: string }>;
    }>
  >("/api/admin/categories");

  useEffect(() => {
    setSelected(new Set());
    setPage(0);
  }, [queryPath]);

  useEffect(() => {
    setPage(0);
  }, [pageSize]);

  const rows = data?.items || [];
  const pagedRows = useMemo(() => {
    const start = page * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const pageIds = pagedRows.map((row) => row.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  };

  const printItems = async (items: BarcodeItem[]) => {
    if (!items.length) {
      setActionError("Select at least one barcode to print.");
      return;
    }
    setBusy(true);
    setActionError("");
    setMessage("");
    try {
      const labelSize = layoutToLabelSize(labelLayout);
      const first = items[0];

      // One print job for the whole selection (continuous roll / single dialog).
      await printProductStickers({
        layout: labelLayout,
        labelSize,
        price: first.price,
        meta: {
          productName: first.product_name,
          shortName: first.short_name || undefined,
          categoryName: first.category_name || undefined,
          sku: first.sku,
          slug: first.slug || undefined,
          color: first.color,
          tag: first.tag,
          hsnCode: first.hsn_code || undefined,
          compareAtPrice: first.compare_at_price
        },
        items: items.map((item) => ({
          id: item.id,
          unit_code: item.unit_code,
          barcode: item.barcode,
          tag: item.tag,
          seq: item.seq,
          price: item.price,
          sizeLabel: item.variant_name || null,
          labelSize,
          productName: item.product_name,
          shortName: item.short_name || undefined,
          categoryName: item.category_name || undefined,
          sku: item.sku,
          slug: item.slug || undefined,
          color: item.color,
          hsnCode: item.hsn_code || undefined,
          compareAtPrice: item.compare_at_price
        }))
      });

      const mark = await adminFetch("/api/admin/barcodes", {
        method: "PATCH",
        json: {
          itemIds: items.map((item) => item.id),
          label_printed: true
        }
      });
      if (mark.error) throw new Error(mark.error);

      setMessage(`Printed ${items.length} barcode sticker${items.length === 1 ? "" : "s"}.`);
      setSelected(new Set());
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not print barcodes");
    } finally {
      setBusy(false);
    }
  };

  const selectedRows = rows.filter((row) => selected.has(row.id));

  return (
    <>
      <AdminPageHeader
        eyebrow="Labelling"
        title="Print barcodes"
        description="Print unique piece barcodes after GRN / inward. Independent from Product Master editing."
        actions={
          <>
            <Link className="admin-icon-tip" href="/admin/inventory/grn">
              <ArrowDownToLine size={16} strokeWidth={2} />
              <span>GRN entry</span>
            </Link>
            <Link className="admin-icon-tip" href="/admin/inventory/approvals">
              <ClipboardCheck size={16} strokeWidth={2} />
              <span>GRN approvals</span>
            </Link>
            <Link className="admin-icon-tip" href="/admin/products">
              <Package size={16} strokeWidth={2} />
              <span>Product Master</span>
            </Link>
            <button
              type="button"
              className="admin-icon-tip"
              onClick={() => void reload()}
              disabled={loading || busy}
            >
              <RefreshCw size={16} strokeWidth={2} />
              <span>Refresh</span>
            </button>
          </>
        }
      />

      {error && <AdminAlert>{error}</AdminAlert>}
      {actionError && <AdminAlert>{actionError}</AdminAlert>}
      {message && <AdminAlert tone="ok">{message}</AdminAlert>}

      <div className="inv-summary">
        <article className="inv-summary-card">
          <Printer size={16} />
          <div>
            <span>Listed</span>
            <strong>{data?.summary.total ?? "—"}</strong>
          </div>
        </article>
        <article className="inv-summary-card inv-summary-card--warn">
          <div>
            <span>Unprinted</span>
            <strong>{data?.summary.unprinted ?? "—"}</strong>
          </div>
        </article>
        <article className="inv-summary-card">
          <div>
            <span>Products</span>
            <strong>{data?.summary.products ?? "—"}</strong>
          </div>
        </article>
        <article className="inv-summary-card inv-summary-card--ok">
          <div>
            <span>Selected</span>
            <strong>{selected.size}</strong>
          </div>
        </article>
      </div>

      <AdminPanel
        title="Barcode queue"
        actions={
          <div className="grn-line-actions">
            <button
              type="button"
              className="admin-icon-tip admin-action-btn--primary"
              disabled={busy || !selectedRows.length}
              onClick={() => void printItems(selectedRows)}
              data-tooltip="Print selected"
              aria-label="Print selected barcodes"
            >
              <Printer size={16} strokeWidth={2} />
              <span>Print selected</span>
            </button>
            <button
              type="button"
              className="admin-icon-tip"
              disabled={busy || !rows.length}
              onClick={() => void printItems(rows.filter((row) => !row.label_printed))}
              data-tooltip="Print all unprinted"
              aria-label="Print all unprinted barcodes"
            >
              <CheckSquare size={16} strokeWidth={2} />
              <span>Print all unprinted</span>
            </button>
          </div>
        }
      >
        <div className="inv-filters">
          <label className="inv-search">
            <span>Search</span>
            <div className="admin-search-field">
              <Search size={15} aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Product name or barcode…"
              />
            </div>
          </label>
          <label>
            <span>Label type</span>
            <select
              value={labelLayout}
              onChange={(e) => setLabelLayout(e.target.value as LabelLayout)}
            >
              {LABEL_LAYOUT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.hint})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              value={unprintedOnly ? "unprinted" : "all"}
              onChange={(e) => setUnprintedOnly(e.target.value === "unprinted")}
            >
              <option value="unprinted">Unprinted only</option>
              <option value="all">All sellable pieces</option>
            </select>
          </label>
          <label>
            <span>Added</span>
            <select value={addedFilter} onChange={(e) => setAddedFilter(e.target.value)}>
              <option value="">Any time</option>
              <option value="1">Today</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </label>
          <label>
            <span>Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setSubcategoryFilter("");
              }}
            >
              <option value="">All categories</option>
              {(categories || []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Subcategory</span>
            <select
              value={subcategoryFilter}
              onChange={(e) => setSubcategoryFilter(e.target.value)}
              disabled={!categoryFilter}
            >
              <option value="">All subcategories</option>
              {((categories || []).find((c) => c.id === categoryFilter)?.subcategories || []).map(
                (item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                )
              )}
            </select>
          </label>
          {productFilter ? (
            <AdminAlert tone="ok">
              Filtered to one product. <Link href="/admin/barcodes">Show all</Link>
            </AdminAlert>
          ) : null}
        </div>

        {loading && <AdminLoading />}
        {!loading && !rows.length && (
          <AdminEmpty
            title="No barcodes in queue"
            body="Receive stock on GRN to generate unique piece barcodes, then print them here."
          />
        )}

        {rows.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="admin-action-btn" onClick={toggleAll} aria-label="Select all">
                      {selected.size === rows.length ? <CheckSquare size={15} /> : <Square size={15} />}
                    </button>
                  </th>
                  <th>Product</th>
                  <th>Unit / barcode</th>
                  <th>Price</th>
                  <th>Added</th>
                  <th>Print</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className="admin-action-btn"
                        onClick={() => toggle(row.id)}
                        aria-label={`Select ${row.barcode}`}
                      >
                        {selected.has(row.id) ? <CheckSquare size={15} /> : <Square size={15} />}
                      </button>
                    </td>
                    <td>
                      <b>{row.product_name}</b>
                      <div className="muted admin-sub">
                        {[row.color, row.category_name, row.subcategory_name]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </td>
                    <td>
                      <div>
                        <code>{row.barcode}</code>
                      </div>
                      <div className="muted admin-sub">{row.unit_code}</div>
                    </td>
                    <td>{formatMoney(row.price)}</td>
                    <td>{formatDate(row.date_added)}</td>
                    <td>
                      <AdminBadge tone={row.label_printed ? "success" : "warn"}>
                        {row.label_printed ? "Printed" : "Pending"}
                      </AdminBadge>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-action-btn admin-action-btn--primary"
                        disabled={busy}
                        onClick={() => void printItems([row])}
                        data-tooltip="Print this barcode"
                      >
                        <Printer size={15} strokeWidth={2} />
                        <span>Print</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <AdminPagination
              page={page}
              pageSize={pageSize}
              total={rows.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="barcodes"
            />
          </div>
        )}
      </AdminPanel>
    </>
  );
}

export default function AdminBarcodesPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <BarcodesPageInner />
    </Suspense>
  );
}
