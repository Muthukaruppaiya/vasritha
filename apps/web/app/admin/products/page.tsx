"use client";

import { useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  FileSpreadsheet,
  PackageSearch,
  RotateCcw,
  Search,
  Upload
} from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  statusTone
} from "../../../components/admin/admin-ui";
import {
  blankProductForm,
  ProductFormImage,
  ProductFormModal,
  ProductFormValues
} from "../../../components/admin/product-form-modal";
import { ProductDetailModal } from "../../../components/admin/product-detail-modal";
import { adminFetch, formatDate, formatMoney, getAdminToken } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type Product = {
  id: string;
  name: string;
  slug: string;
  sku?: string | null;
  barcode?: string | null;
  price: string;
  compare_at_price: string | null;
  status: string;
  stock_quantity: number;
  category_id: string;
  subcategory_id?: string | null;
  category_name?: string | null;
  subcategory_name?: string | null;
  primary_image?: string | null;
  short_description?: string;
  short_name?: string;
  color?: string | null;
  description?: string;
  is_featured?: boolean;
  created_at: string;
  unit_count?: number;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  subcategories?: Array<{ id: string; name: string; slug: string }>;
};

type SortKey = "newest" | "name" | "price-asc" | "price-desc" | "stock";

const LOW_STOCK_THRESHOLD = 10;

const COLOR_SWATCHES: Record<string, string> = {
  "crimson red": "#a4291f",
  "blush pink": "#e6b6c4",
  "ivory cream": "#f3ead9",
  "indigo blue": "#2f4570",
  "antique gold": "#b8860b",
  gold: "#d4af37",
  multicolour: "linear-gradient(135deg,#c0392b,#f1c40f,#27ae60,#2980b9)",
  "natural wood": "#8b5e34",
  "antique brass": "#7c5a3a",
  maroon: "#7b1e2b",
  "emerald green": "#046a52",
  black: "#111111",
  white: "#ffffff"
};

function colorSwatchStyle(color?: string | null) {
  if (!color) return undefined;
  const hit = COLOR_SWATCHES[color.trim().toLowerCase()];
  return { background: hit || "#e5ded4" };
}

export default function AdminProductsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [featuredFilter, setFeaturedFilter] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [formValues, setFormValues] = useState<ProductFormValues>(blankProductForm());
  const [formImages, setFormImages] = useState<ProductFormImage[]>([]);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: products, error, loading, reload } = useAdminQuery<Product[]>("/api/admin/products");
  const { data: categories } = useAdminQuery<Category[]>("/api/admin/categories");

  const colourOptions = useMemo(() => {
    const set = new Set<string>();
    for (const product of products || []) {
      const color = product.color?.trim();
      if (color) set.add(color);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...(products || [])];

    if (q) {
      list = list.filter((product) => {
        const haystack = [
          product.name,
          product.slug,
          product.sku,
          product.barcode,
          product.color,
          product.category_name
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    if (statusFilter) list = list.filter((p) => p.status === statusFilter);
    if (categoryFilter) list = list.filter((p) => p.category_id === categoryFilter);
    if (subcategoryFilter) list = list.filter((p) => p.subcategory_id === subcategoryFilter);
    if (colorFilter) list = list.filter((p) => (p.color || "") === colorFilter);
    if (featuredFilter === "yes") list = list.filter((p) => p.is_featured);
    if (featuredFilter === "no") list = list.filter((p) => !p.is_featured);

    if (stockFilter === "in") list = list.filter((p) => p.stock_quantity > LOW_STOCK_THRESHOLD);
    if (stockFilter === "low") {
      list = list.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= LOW_STOCK_THRESHOLD);
    }
    if (stockFilter === "out") list = list.filter((p) => p.stock_quantity <= 0);

    if (priceMin) list = list.filter((p) => Number(p.price) >= Number(priceMin));
    if (priceMax) list = list.filter((p) => Number(p.price) <= Number(priceMax));

    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "price-asc") return Number(a.price) - Number(b.price);
      if (sortBy === "price-desc") return Number(b.price) - Number(a.price);
      if (sortBy === "stock") return a.stock_quantity - b.stock_quantity;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return list;
  }, [
    products,
    search,
    statusFilter,
    categoryFilter,
    subcategoryFilter,
    colorFilter,
    stockFilter,
    featuredFilter,
    priceMin,
    priceMax,
    sortBy
  ]);

  const hasActiveFilters = Boolean(
    search ||
      statusFilter ||
      categoryFilter ||
      subcategoryFilter ||
      colorFilter ||
      stockFilter ||
      featuredFilter ||
      priceMin ||
      priceMax ||
      sortBy !== "newest"
  );

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setCategoryFilter("");
    setSubcategoryFilter("");
    setColorFilter("");
    setStockFilter("");
    setFeaturedFilter("");
    setPriceMin("");
    setPriceMax("");
    setSortBy("newest");
  };

  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  const toggleSelectAll = () => {
    setSelected((current) => {
      if (allVisibleSelected) {
        const next = new Set(current);
        filtered.forEach((p) => next.delete(p.id));
        return next;
      }
      const next = new Set(current);
      filtered.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const openCreate = () => {
    setModalMode("create");
    setFormValues(blankProductForm(categories?.[0]?.id || ""));
    setFormImages([]);
    setModalOpen(true);
  };

  const openEdit = async (productId: string) => {
    setLoadingEdit(true);
    const result = await adminFetch<
      Product & {
        product_images?: Array<{ id: string; storage_path: string }>;
        tag?: string | null;
        sku_prefix?: string | null;
        label_size?: "accessory" | "dress";
        image_upload_token?: string;
      }
    >(`/api/admin/products/${productId}`);
    setLoadingEdit(false);

    if (result.error || !result.data) return;

    const product = result.data;
    setModalMode("edit");
    setFormValues({
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku || `VAS-${product.id.slice(0, 8).toUpperCase()}`,
      barcode:
        product.barcode ||
        (product.sku || `VAS${product.id.slice(0, 8)}`).replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      tag: product.tag || product.sku || "",
      sku_prefix: product.sku_prefix || "VAS",
      label_size: product.label_size === "accessory" ? "accessory" : "dress",
      image_upload_token: product.image_upload_token,
      category_id: product.category_id,
      subcategory_id: product.subcategory_id || "",
      price: String(product.price ?? ""),
      compare_at_price: product.compare_at_price ? String(product.compare_at_price) : "",
      stock_quantity: String(product.stock_quantity ?? 0),
      status: product.status,
      short_name: product.short_name || "",
      short_description: product.short_description || "",
      color: product.color || "",
      description: product.description || "",
      is_featured: Boolean(product.is_featured)
    });
    setFormImages(
      (product.product_images || []).map((image) => ({
        id: image.id,
        storage_path: image.storage_path
      }))
    );
    setModalOpen(true);
  };

  const updateStatus = async (id: string, nextStatus: string) => {
    const result = await adminFetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      json: { status: nextStatus }
    });
    if (!result.error) await reload();
  };

  const bulkUpdateStatus = async (nextStatus: string) => {
    if (!selected.size) return;
    setBulkBusy(true);
    await Promise.all(
      Array.from(selected).map((id) =>
        adminFetch(`/api/admin/products/${id}`, { method: "PATCH", json: { status: nextStatus } })
      )
    );
    setBulkBusy(false);
    clearSelection();
    await reload();
  };

  const onImportFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;

    setImportBusy(true);
    setImportError("");
    setImportMessage("");

    try {
      const token = getAdminToken();
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || "Import failed");
      }

      const data = (payload as {
        data?: { created: number; updated: number; failed: Array<{ name: string; error: string }> };
      }).data;

      const failedCount = data?.failed?.length || 0;
      setImportMessage(
        `Imported ${data?.created || 0} new, updated ${data?.updated || 0}${
          failedCount ? `, ${failedCount} failed` : ""
        }.`
      );
      if (failedCount && data?.failed?.[0]) {
        setImportError(data.failed.map((item) => `${item.name}: ${item.error}`).slice(0, 3).join(" · "));
      }
      await reload();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  return (
    <>
      <AdminPageHeader
        eyebrow=""
        title="Product Master"
        actions={
          <>
            <a
              className="admin-ghost-btn"
              href="/samples/product-import-sample.xls"
              download="vasritha-product-import-sample.xls"
            >
              <FileSpreadsheet size={14} />
              Sample Excel
            </a>
            <button
              type="button"
              className="admin-ghost-btn"
              disabled={importBusy}
              onClick={() => importInputRef.current?.click()}
            >
              <Upload size={14} />
              {importBusy ? "Importing…" : "Import bulk data"}
            </button>
            <button type="button" className="btn" onClick={openCreate}>
              + New product
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,.xls,text/csv,application/vnd.ms-excel"
              hidden
              onChange={(e) => void onImportFile(e.target.files)}
            />
          </>
        }
      />

      {(importMessage || importError) && (
        <div className="admin-import-feedback">
          {importMessage ? <AdminAlert tone="ok">{importMessage}</AdminAlert> : null}
          {importError ? <AdminAlert>{importError}</AdminAlert> : null}
        </div>
      )}

      <div className="admin-filter-panel">
        <div className="admin-filter-panel-head">
          <div>
            <strong>Filters</strong>
            <p className="muted">Search and narrow the catalogue</p>
          </div>
          {hasActiveFilters ? (
            <button type="button" className="admin-ghost-btn admin-filter-reset" onClick={clearFilters}>
              <RotateCcw size={14} />
              Reset
            </button>
          ) : null}
        </div>

        <div className="admin-filter-grid">
          <label className="admin-filter-search">
            <span>Search</span>
            <div className="admin-search-field">
              <Search size={15} aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, code, colour, barcode…"
              />
            </div>
          </label>

          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
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

          <label>
            <span>Colour</span>
            <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value)}>
              <option value="">All colours</option>
              {colourOptions.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Stock</span>
            <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
              <option value="">All stock levels</option>
              <option value="in">In stock</option>
              <option value="low">Low stock (≤ {LOW_STOCK_THRESHOLD})</option>
              <option value="out">Out of stock</option>
            </select>
          </label>

          <label>
            <span>Fast selling</span>
            <select value={featuredFilter} onChange={(e) => setFeaturedFilter(e.target.value)}>
              <option value="">All products</option>
              <option value="yes">Fast selling only</option>
              <option value="no">Not fast selling</option>
            </select>
          </label>

          <label>
            <span>Price range (₹)</span>
            <div className="admin-range-field">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="Min"
              />
              <span className="admin-range-sep">–</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="Max"
              />
            </div>
          </label>

          <label>
            <span>Sort by</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
              <option value="newest">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="stock">Stock: low to high</option>
            </select>
          </label>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="admin-bulk-bar">
          <span>
            <b>{selected.size}</b> selected
          </span>
          <div className="admin-bulk-actions">
            <button type="button" disabled={bulkBusy} onClick={() => void bulkUpdateStatus("active")}>
              Publish
            </button>
            <button type="button" disabled={bulkBusy} onClick={() => void bulkUpdateStatus("draft")}>
              Unpublish
            </button>
            <button type="button" disabled={bulkBusy} onClick={() => void bulkUpdateStatus("archived")}>
              Archive
            </button>
            <button type="button" className="admin-bulk-clear" onClick={clearSelection}>
              Clear
            </button>
          </div>
        </div>
      )}

      <AdminPanel title={`Catalogue · ${filtered.length} shown`}>
        {(loading || loadingEdit) && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !error && !filtered.length && (
          <div className="admin-empty admin-empty-rich">
            <PackageSearch size={30} strokeWidth={1.5} />
            <strong>{products?.length ? "No matching products" : "No products yet"}</strong>
            <p className="muted">
              {products?.length
                ? "Try adjusting or resetting your filters."
                : "Create your first product to populate the storefront."}
            </p>
            {products?.length ? (
              <button type="button" className="admin-ghost-btn" onClick={clearFilters}>
                <RotateCcw size={14} />
                Reset filters
              </button>
            ) : (
              <button type="button" className="btn" onClick={openCreate}>
                + New product
              </button>
            )}
          </div>
        )}
        {filtered.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th className="admin-check-col">
                    <input
                      type="checkbox"
                      aria-label="Select all products"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Product</th>
                  <th>Code</th>
                  <th>Colour</th>
                  <th>Category</th>
                  <th>Subcategory</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id} className={selected.has(product.id) ? "is-selected" : ""}>
                    <td className="admin-check-col">
                      <input
                        type="checkbox"
                        aria-label={`Select ${product.name}`}
                        checked={selected.has(product.id)}
                        onChange={() => toggleSelected(product.id)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-product-open"
                        onClick={() => setDetailId(product.id)}
                      >
                        <div className="admin-product-cell">
                          {product.primary_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.primary_image} alt="" className="admin-product-thumb" />
                          ) : (
                            <span className="admin-product-thumb admin-product-thumb--empty" />
                          )}
                          <div>
                            <b>{product.name}</b>
                            <div className="muted admin-sub">{product.slug}</div>
                            {product.is_featured ? (
                              <div className="admin-sub admin-fast-tag">Fast selling</div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </td>
                    <td>
                      <div>{product.sku || "—"}</div>
                      <div className="muted admin-sub">{product.barcode || ""}</div>
                      <button
                        type="button"
                        className="admin-text-link"
                        onClick={() => setDetailId(product.id)}
                      >
                        {Number(product.unit_count || 0)} unique barcodes
                      </button>
                    </td>
                    <td>
                      {product.color ? (
                        <span className="admin-color-cell">
                          <span className="admin-color-dot" style={colorSwatchStyle(product.color)} />
                          {product.color}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{product.category_name || "—"}</td>
                    <td>{product.subcategory_name || "—"}</td>
                    <td>
                      {formatMoney(product.price)}
                      {product.compare_at_price ? (
                        <div className="muted admin-sub strike">{formatMoney(product.compare_at_price)}</div>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className={
                          product.stock_quantity <= 0
                            ? "admin-stock admin-stock--out"
                            : product.stock_quantity <= LOW_STOCK_THRESHOLD
                              ? "admin-stock admin-stock--low"
                              : "admin-stock"
                        }
                      >
                        {product.stock_quantity}
                      </span>
                    </td>
                    <td>
                      <AdminBadge tone={statusTone(product.status)}>{product.status}</AdminBadge>
                    </td>
                    <td>{formatDate(product.created_at)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button type="button" onClick={() => setDetailId(product.id)}>
                          Details
                        </button>
                        <button type="button" onClick={() => void openEdit(product.id)}>
                          Edit
                        </button>
                        {product.status === "active" && (
                          <a
                            href={`/products/${product.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View on storefront"
                          >
                            <ExternalLink size={12} />
                            View
                          </a>
                        )}
                        {product.status !== "active" && (
                          <button type="button" onClick={() => void updateStatus(product.id, "active")}>
                            Publish
                          </button>
                        )}
                        {product.status === "active" && (
                          <button type="button" onClick={() => void updateStatus(product.id, "draft")}>
                            Unpublish
                          </button>
                        )}
                        {product.status !== "archived" && (
                          <button type="button" onClick={() => void updateStatus(product.id, "archived")}>
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      <ProductDetailModal
        productId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(id) => {
          setDetailId(null);
          void openEdit(id);
        }}
      />

      <ProductFormModal
        open={modalOpen}
        mode={modalMode}
        categories={categories || []}
        initial={formValues}
        initialImages={formImages}
        onClose={() => setModalOpen(false)}
        onSaved={() => void reload()}
      />
    </>
  );
}
