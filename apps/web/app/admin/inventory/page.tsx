"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  PackagePlus,
  Pencil,
  Search,
  SlidersHorizontal,
  Warehouse
} from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../components/admin/admin-ui";
import { AdminFormModal } from "../../../components/admin/admin-form-modal";
import { adminFetch, formatDate } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type StockRow = {
  variant_id: string;
  sku: string | null;
  variant_name: string | null;
  attributes: Record<string, unknown> | null;
  stock_quantity: number;
  product_id: string;
  product_name: string;
  product_status: string;
  hsn_code?: string | null;
  gst_rate?: string | number | null;
  category_id: string | null;
  subcategory_id: string | null;
  category_name: string | null;
  subcategory_name: string | null;
};

type InventoryData = {
  movements: Array<{
    id: string;
    product_variant_id: string;
    type: string;
    quantity: number;
    note: string | null;
    created_at: string;
    sku?: string | null;
    variant_name?: string | null;
    product_id?: string;
    product_name?: string | null;
  }>;
  stock: StockRow[];
  summary?: {
    skuCount: number;
    onHand: number;
    inStock: number;
    lowStock: number;
    outOfStock: number;
  };
  lowStockThreshold?: number;
};

type InwardLine = { productVariantId: string; quantity: string };

const blankAdjust = (variantId = "") => ({
  productVariantId: variantId,
  type: "manual_adjustment",
  quantity: "1",
  note: ""
});

const blankInward = (variantId = "") => ({
  supplier: "",
  billNo: "",
  note: "",
  lines: [{ productVariantId: variantId, quantity: "1" }] as InwardLine[]
});

function stockTone(qty: number, low: number): "success" | "warn" | "danger" {
  if (qty <= 0) return "danger";
  if (qty <= low) return "warn";
  return "success";
}

function stockLabel(qty: number, low: number) {
  if (qty <= 0) return "Out of stock";
  if (qty <= low) return "Low stock";
  return "In stock";
}

function movementLabel(type: string) {
  const map: Record<string, string> = {
    purchase: "Inward / purchase",
    opening_stock: "Opening stock",
    manual_adjustment: "Adjustment",
    return: "Return in",
    sale: "Sale out"
  };
  return map[type] || type;
}

function AdminInventoryPageInner() {
  const searchParams = useSearchParams();
  const focusProduct = searchParams.get("product") || "";
  const focusVariant = searchParams.get("variant") || "";

  const queryPath = focusProduct
    ? `/api/admin/inventory?product=${encodeURIComponent(focusProduct)}`
    : "/api/admin/inventory";

  const { data, loading, error, reload } = useAdminQuery<InventoryData>(queryPath);
  const { data: categories } = useAdminQuery<
    Array<{
      id: string;
      name: string;
      subcategories?: Array<{ id: string; name: string }>;
    }>
  >("/api/admin/categories");

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [inwardOpen, setInwardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [adjust, setAdjust] = useState(blankAdjust);
  const [inward, setInward] = useState(blankInward);

  const low = data?.lowStockThreshold ?? 10;

  const stockOptions = useMemo(() => {
    let list = data?.stock || [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((row) => {
        const hay = [row.product_name, row.sku, row.variant_name, row.category_name, row.subcategory_name, row.hsn_code]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (categoryFilter) list = list.filter((row) => row.category_id === categoryFilter);
    if (subcategoryFilter) list = list.filter((row) => row.subcategory_id === subcategoryFilter);
    if (stockFilter === "in") list = list.filter((row) => row.stock_quantity > low);
    if (stockFilter === "low") {
      list = list.filter((row) => row.stock_quantity > 0 && row.stock_quantity <= low);
    }
    if (stockFilter === "out") list = list.filter((row) => row.stock_quantity <= 0);
    return list;
  }, [data?.stock, search, categoryFilter, subcategoryFilter, stockFilter, low]);

  useEffect(() => {
    if (!focusVariant || !data?.stock?.length) return;
    const hit = data.stock.find((row) => row.variant_id === focusVariant);
    if (!hit) return;
    setInward(blankInward(focusVariant));
    setInwardOpen(true);
  }, [focusVariant, data?.stock]);

  const openAdjust = (variantId = "") => {
    setAdjust(blankAdjust(variantId));
    setFormError("");
    setAdjustOpen(true);
  };

  const openInward = (variantId = "") => {
    setInward(blankInward(variantId));
    setFormError("");
    setInwardOpen(true);
  };

  const onAdjustSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const result = await adminFetch("/api/admin/inventory", {
      method: "POST",
      json: {
        productVariantId: adjust.productVariantId,
        type: adjust.type,
        quantity: Number(adjust.quantity),
        note: adjust.note || undefined
      }
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setAdjustOpen(false);
    setAdjust(blankAdjust());
    await reload();
  };

  const onInwardSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const result = await adminFetch("/api/admin/inventory/inward", {
      method: "POST",
      json: {
        supplier: inward.supplier || undefined,
        billNo: inward.billNo || undefined,
        note: inward.note || undefined,
        lines: inward.lines.map((line) => ({
          productVariantId: line.productVariantId,
          quantity: Number(line.quantity)
        }))
      }
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setInwardOpen(false);
    setInward(blankInward());
    await reload();
  };

  const summary = data?.summary;

  return (
    <>
      <AdminPageHeader
        eyebrow="Stock operations"
        title="Inventory"
        description="Receive and adjust stock here. Create and edit product details in Product Master."
        actions={
          <>
            <Link
              className="admin-icon-tip"
              href="/admin/products"
              data-tooltip="Product Master"
              aria-label="Product Master"
            >
              <PackagePlus size={16} strokeWidth={2} />
              <span>Product Master</span>
            </Link>
            <button
              type="button"
              className="admin-icon-tip admin-action-btn--primary"
              onClick={() => openInward()}
              disabled={!data?.stock?.length}
              data-tooltip="Receive stock (GRN)"
              aria-label="Receive stock"
            >
              <ArrowDownToLine size={16} strokeWidth={2} />
              <span>Receive stock</span>
            </button>
            <button
              type="button"
              className="admin-icon-tip"
              onClick={() => openAdjust()}
              disabled={!data?.stock?.length}
              data-tooltip="Adjust stock"
              aria-label="Adjust stock"
            >
              <SlidersHorizontal size={16} strokeWidth={2} />
              <span>Adjust stock</span>
            </button>
          </>
        }
      />

      <section className="inv-flow" aria-label="Inventory workflow">
        <div className="inv-flow-step">
          <span className="inv-flow-num">1</span>
          <div>
            <strong>Product Master</strong>
            <p>Create the product (name, SKU, price, images).</p>
          </div>
        </div>
        <div className="inv-flow-arrow" aria-hidden>
          →
        </div>
        <div className="inv-flow-step is-current">
          <span className="inv-flow-num">2</span>
          <div>
            <strong>Inventory</strong>
            <p>Receive inward stock (GRN) to increase on-hand qty.</p>
          </div>
        </div>
        <div className="inv-flow-arrow" aria-hidden>
          →
        </div>
        <div className="inv-flow-step">
          <span className="inv-flow-num">3</span>
          <div>
            <strong>Sell / adjust</strong>
            <p>POS &amp; online reduce stock; use Adjust for corrections.</p>
          </div>
        </div>
      </section>

      {focusProduct ? (
        <AdminAlert tone="ok">
          Showing stock for one product from Product Master.{" "}
          <Link href="/admin/inventory">Clear filter</Link>
        </AdminAlert>
      ) : null}

      <div className="inv-summary">
        <article className="inv-summary-card">
          <Warehouse size={16} />
          <div>
            <span>SKUs</span>
            <strong>{summary?.skuCount ?? "—"}</strong>
          </div>
        </article>
        <article className="inv-summary-card">
          <div>
            <span>Total on hand</span>
            <strong>{summary?.onHand ?? "—"}</strong>
          </div>
        </article>
        <article className="inv-summary-card inv-summary-card--ok">
          <div>
            <span>In stock</span>
            <strong>{summary?.inStock ?? "—"}</strong>
          </div>
        </article>
        <article className="inv-summary-card inv-summary-card--warn">
          <div>
            <span>Low (≤ {low})</span>
            <strong>{summary?.lowStock ?? "—"}</strong>
          </div>
        </article>
        <article className="inv-summary-card inv-summary-card--danger">
          <div>
            <span>Out of stock</span>
            <strong>{summary?.outOfStock ?? "—"}</strong>
          </div>
        </article>
      </div>

      <AdminPanel title="Current stock">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}

        <div className="inv-filters">
          <label className="inv-search">
            <span>Search</span>
            <div className="admin-search-field">
              <Search size={15} aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Product, SKU, HSN, category…"
              />
            </div>
          </label>
          <label>
            <span>Stock level</span>
            <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
              <option value="">All levels</option>
              <option value="in">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
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
        </div>

        {!loading && !stockOptions.length && (
          <AdminEmpty
            title={data?.stock?.length ? "No matching stock rows" : "No products to track yet"}
            body={
              data?.stock?.length
                ? "Try clearing filters."
                : "Create a product in Product Master first, then return here to receive stock."
            }
          />
        )}
        {!loading && !data?.stock?.length ? (
          <div className="inv-empty-actions">
            <Link className="btn" href="/admin/products">
              Go to Product Master
            </Link>
          </div>
        ) : null}

        {stockOptions.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>SKU / variant</th>
                  <th>HSN / GST</th>
                  <th>On hand</th>
                  <th>Level</th>
                  <th>Catalogue</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stockOptions.map((row) => (
                  <tr key={row.variant_id}>
                    <td>
                      <b>{row.product_name}</b>
                    </td>
                    <td>
                      {row.category_name || "—"}
                      {row.subcategory_name ? (
                        <div className="muted admin-sub">{row.subcategory_name}</div>
                      ) : null}
                    </td>
                    <td>
                      <div>{row.sku || "—"}</div>
                      <div className="muted admin-sub">{row.variant_name || "Default"}</div>
                    </td>
                    <td>
                      <div>{row.hsn_code || "—"}</div>
                      <div className="muted admin-sub">
                        {row.gst_rate != null && row.gst_rate !== "" ? `${Number(row.gst_rate)}%` : "—"}
                      </div>
                    </td>
                    <td>
                      <strong>{row.stock_quantity}</strong>
                    </td>
                    <td>
                      <AdminBadge tone={stockTone(row.stock_quantity, low)}>
                        {stockLabel(row.stock_quantity, low)}
                      </AdminBadge>
                    </td>
                    <td>
                      <AdminBadge tone={row.product_status === "active" ? "success" : "warn"}>
                        {row.product_status}
                      </AdminBadge>
                    </td>
                    <td>
                      <div className="inv-row-actions" role="group" aria-label="Stock actions">
                        <button
                          type="button"
                          className="admin-action-btn admin-action-btn--primary"
                          onClick={() => openInward(row.variant_id)}
                          data-tooltip="Receive stock"
                          aria-label={`Receive stock for ${row.product_name}`}
                        >
                          <ArrowDownToLine size={15} strokeWidth={2} />
                          <span>Receive</span>
                        </button>
                        <button
                          type="button"
                          className="admin-action-btn"
                          onClick={() => openAdjust(row.variant_id)}
                          data-tooltip="Adjust stock"
                          aria-label={`Adjust stock for ${row.product_name}`}
                        >
                          <SlidersHorizontal size={15} strokeWidth={2} />
                          <span>Adjust</span>
                        </button>
                        <Link
                          className="admin-action-btn"
                          href={`/admin/products?focus=${row.product_id}`}
                          data-tooltip="Edit product"
                          aria-label={`Edit product ${row.product_name}`}
                        >
                          <Pencil size={15} strokeWidth={2} />
                          <span>Edit</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      <AdminPanel title="Stock ledger (recent movements)">
        {loading && <AdminLoading />}
        {!loading && !(data?.movements || []).length && (
          <AdminEmpty
            title="No movements yet"
            body="Receive inward stock or post an adjustment to start the ledger."
          />
        )}
        {(data?.movements || []).length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {(data?.movements || []).map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDate(movement.created_at)}</td>
                    <td>
                      <b>{movement.product_name || "—"}</b>
                      <div className="muted admin-sub">
                        {movement.sku || "—"}
                        {movement.variant_name ? ` · ${movement.variant_name}` : ""}
                      </div>
                    </td>
                    <td>{movementLabel(movement.type)}</td>
                    <td className={Number(movement.quantity) < 0 ? "inv-qty-out" : "inv-qty-in"}>
                      {Number(movement.quantity) > 0 ? "+" : ""}
                      {movement.quantity}
                    </td>
                    <td>{movement.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      <AdminFormModal
        open={inwardOpen}
        title="Receive stock (GRN)"
        eyebrow="Step 2 · Inventory"
        submitLabel="Post inward"
        savingLabel="Posting…"
        saving={saving}
        error={formError}
        onClose={() => setInwardOpen(false)}
        onSubmit={onInwardSubmit}
      >
        <p className="admin-span-2 muted inv-modal-hint">
          Use this when goods arrive from a supplier. Product must already exist in Product Master.
        </p>
        <label>
          <span>Supplier</span>
          <input
            value={inward.supplier}
            onChange={(e) => setInward((f) => ({ ...f, supplier: e.target.value }))}
            placeholder="Optional"
          />
        </label>
        <label>
          <span>Bill / invoice no.</span>
          <input
            value={inward.billNo}
            onChange={(e) => setInward((f) => ({ ...f, billNo: e.target.value }))}
            placeholder="Optional"
          />
        </label>
        <label className="admin-span-2">
          <span>Note</span>
          <input
            value={inward.note}
            onChange={(e) => setInward((f) => ({ ...f, note: e.target.value }))}
            placeholder="Optional remark"
          />
        </label>

        <div className="admin-span-2" style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: "0.85rem" }}>Lines</strong>
            <button
              type="button"
              className="btn admin-ghost-btn"
              onClick={() =>
                setInward((f) => ({
                  ...f,
                  lines: [...f.lines, { productVariantId: "", quantity: "1" }]
                }))
              }
            >
              + Add line
            </button>
          </div>
          {inward.lines.map((line, index) => (
            <div
              key={`line-${index}`}
              style={{ display: "grid", gridTemplateColumns: "1fr 110px auto", gap: 8 }}
            >
              <select
                required
                value={line.productVariantId}
                onChange={(e) =>
                  setInward((f) => {
                    const lines = [...f.lines];
                    lines[index] = { ...lines[index], productVariantId: e.target.value };
                    return { ...f, lines };
                  })
                }
              >
                <option value="">Select SKU / variant</option>
                {(data?.stock || []).map((row) => (
                  <option key={row.variant_id} value={row.variant_id}>
                    {row.product_name} · {row.sku || "no-sku"} · on hand {row.stock_quantity}
                  </option>
                ))}
              </select>
              <input
                required
                type="number"
                min={1}
                step={1}
                value={line.quantity}
                onChange={(e) =>
                  setInward((f) => {
                    const lines = [...f.lines];
                    lines[index] = { ...lines[index], quantity: e.target.value };
                    return { ...f, lines };
                  })
                }
                aria-label="Inward quantity"
              />
              <button
                type="button"
                className="btn admin-ghost-btn"
                disabled={inward.lines.length <= 1}
                onClick={() =>
                  setInward((f) => ({
                    ...f,
                    lines: f.lines.filter((_, i) => i !== index)
                  }))
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </AdminFormModal>

      <AdminFormModal
        open={adjustOpen}
        title="Adjust stock"
        eyebrow="Corrections only"
        submitLabel="Post adjustment"
        savingLabel="Posting…"
        saving={saving}
        error={formError}
        onClose={() => setAdjustOpen(false)}
        onSubmit={onAdjustSubmit}
      >
        <p className="admin-span-2 muted inv-modal-hint">
          Prefer Receive (GRN) for new stock. Use Adjust for opening balance, damage, or count corrections.
          Sales are deducted automatically from POS / online orders.
        </p>
        <label className="admin-span-2">
          <span>Variant</span>
          <select
            required
            value={adjust.productVariantId}
            onChange={(e) => setAdjust((f) => ({ ...f, productVariantId: e.target.value }))}
          >
            <option value="">Select variant</option>
            {(data?.stock || []).map((row) => (
              <option key={row.variant_id} value={row.variant_id}>
                {row.product_name} · {row.sku || "no-sku"} · qty {row.stock_quantity}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Type</span>
          <select value={adjust.type} onChange={(e) => setAdjust((f) => ({ ...f, type: e.target.value }))}>
            <option value="opening_stock">Opening stock (+)</option>
            <option value="return">Customer / supplier return (+)</option>
            <option value="manual_adjustment">Manual correction (+/−)</option>
          </select>
        </label>
        <label>
          <span>Quantity</span>
          <input
            required
            type="number"
            value={adjust.quantity}
            onChange={(e) => setAdjust((f) => ({ ...f, quantity: e.target.value }))}
            placeholder={adjust.type === "manual_adjustment" ? "e.g. -2 or 3" : "e.g. 5"}
          />
        </label>
        <label className="admin-span-2">
          <span>Note / reason</span>
          <input
            value={adjust.note}
            onChange={(e) => setAdjust((f) => ({ ...f, note: e.target.value }))}
            placeholder="Required for audits — e.g. stock count, damaged"
          />
        </label>
      </AdminFormModal>
    </>
  );
}

export default function AdminInventoryPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminInventoryPageInner />
    </Suspense>
  );
}
