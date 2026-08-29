"use client";

import { useMemo, useRef, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  GitBranchPlus,
  PackageSearch,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Upload,
  Warehouse
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
  ProductFormValues,
  ProductParentOption
} from "../../../components/admin/product-form-modal";
import { ProductDetailModal } from "../../../components/admin/product-detail-modal";
import { adminFetch, formatDate, formatMoney, getAdminToken } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";
import { printProductStickers } from "../../../lib/print-stickers";

type Product = {
  id: string;
  name: string;
  slug: string;
  sku?: string | null;
  barcode?: string | null;
  price: string;
  compare_at_price: string | null;
  hsn_code?: string | null;
  gst_rate?: string | number | null;
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
  label_size?: "accessory" | "dress";
  tag?: string | null;
  parent_product_id?: string | null;
  parent_name?: string | null;
  parent_sku?: string | null;
  child_count?: number;
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
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminProductsPageInner />
    </Suspense>
  );
}

function AdminProductsPageInner() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus") || "";
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
  const [printBusyId, setPrintBusyId] = useState<string | null>(null);
  const [printMessage, setPrintMessage] = useState("");
  const [printError, setPrintError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [formValues, setFormValues] = useState<ProductFormValues>(blankProductForm());
  const [formImages, setFormImages] = useState<ProductFormImage[]>([]);
  const [formInternalImages, setFormInternalImages] = useState<ProductFormImage[]>([]);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const focusOpened = useRef(false);

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

  const parentOptions = useMemo<ProductParentOption[]>(() => {
    return (products || [])
      .filter((row) => !row.parent_product_id)
      .map((row) => ({
        id: row.id,
        name: row.name,
        sku: row.sku,
        color: row.color
      }));
  }, [products]);

  const openCreateChild = (parent: Product) => {
    setModalMode("create");
    setFormValues({
      ...blankProductForm(parent.category_id || categories?.[0]?.id || ""),
      category_id: parent.category_id,
      subcategory_id: parent.subcategory_id || "",
      parent_product_id: parent.id,
      color: parent.color || "",
      label_size: parent.label_size === "accessory" ? "accessory" : "dress",
      sku_prefix: "VAS",
      name: `${parent.name} · design`,
      short_name: parent.short_name || ""
    });
    setFormImages([]);
    setFormInternalImages([]);
    setModalOpen(true);
  };

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
    setFormInternalImages([]);
    setModalOpen(true);
  };

  const openEdit = async (productId: string) => {
    setLoadingEdit(true);
    const result = await adminFetch<
      Product & {
        product_images?: Array<{ id: string; storage_path: string; image_kind?: string }>;
        internal_images?: Array<{ id: string; storage_path: string; image_kind?: string }>;
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
      parent_product_id: product.parent_product_id || "",
      price: String(product.price ?? ""),
      compare_at_price: product.compare_at_price ? String(product.compare_at_price) : "",
      hsn_code: product.hsn_code || "",
      gst_rate: String(product.gst_rate ?? 5),
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
        storage_path: image.storage_path,
        kind: "website" as const
      }))
    );
    setFormInternalImages(
      (product.internal_images || []).map((image) => ({
        id: image.id,
        storage_path: image.storage_path,
        kind: "internal" as const
      }))
    );
    setModalOpen(true);
  };

  useEffect(() => {
    if (!focusId || loading || focusOpened.current) return;
    if (!(products || []).some((row) => row.id === focusId)) return;
    focusOpened.current = true;
    void openEdit(focusId);
  }, [focusId, loading, products]);

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

  const printBarcodesForProduct = async (
    product: Product,
    mode: "pending" | "all" = "pending"
  ) => {
    setPrintBusyId(product.id);
    setPrintError("");
    setPrintMessage("");
    try {
      const result = await adminFetch<{
        items: Array<{
          id: string;
          unit_code: string;
          barcode: string;
          status?: string;
          label_printed?: boolean;
        }>;
      }>(`/api/admin/products/${product.id}/items`);

      if (result.error) throw new Error(result.error);

      const items = result.data?.items || [];
      const sellable = items.filter((item) => !item.status || item.status === "to_sell");
      let stickers = mode === "all" ? sellable : sellable.filter((item) => !item.label_printed);

      if (!stickers.length && product.barcode) {
        stickers = [
          {
            id: "",
            unit_code: product.sku || product.barcode,
            barcode: product.barcode.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
          }
        ];
      }

      if (!stickers.length) {
        throw new Error(
          mode === "pending"
            ? "No unprinted barcodes. Open the product and use Print all, or receive stock first."
            : "No barcodes to print. Receive stock (GRN) or set opening stock first."
        );
      }

      await printProductStickers({
        price: product.price,
        labelSize: product.label_size === "accessory" ? "accessory" : "dress",
        meta: {
          productName: product.name,
          categoryName: product.subcategory_name || product.category_name || undefined,
          sku: product.sku,
          color: product.color,
          tag: product.tag,
          compareAtPrice: product.compare_at_price
        },
        items: stickers.map((item) => ({
          id: item.id,
          unit_code: item.unit_code,
          barcode: item.barcode,
          tag: product.tag || undefined,
          sizeLabel: product.color,
          price: product.price,
          labelSize: product.label_size === "accessory" ? "accessory" : "dress"
        }))
      });

      const markIds = stickers.map((item) => item.id).filter(Boolean);
      if (markIds.length) {
        await adminFetch(`/api/admin/products/${product.id}/items`, {
          method: "PATCH",
          json: { itemIds: markIds, label_printed: true }
        });
      }

      setPrintMessage(
        `Printed ${stickers.length} barcode sticker${stickers.length === 1 ? "" : "s"} for ${product.name}.`
      );
      await reload();
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : "Could not print barcodes");
    } finally {
      setPrintBusyId(null);
    }
  };

  const bulkPrintBarcodes = async () => {
    if (!selected.size) return;
    setBulkBusy(true);
    setPrintError("");
    setPrintMessage("");
    try {
      const allStickers: Array<{
        id: string;
        unit_code: string;
        barcode: string;
        price: string;
        labelSize: "accessory" | "dress";
        productId: string;
      }> = [];
      const markByProduct = new Map<string, string[]>();

      for (const id of Array.from(selected)) {
        const product = (products || []).find((row) => row.id === id);
        if (!product) continue;
        const result = await adminFetch<{
          items: Array<{
            id: string;
            unit_code: string;
            barcode: string;
            status?: string;
            label_printed?: boolean;
          }>;
        }>(`/api/admin/products/${id}/items`);
        if (result.error) continue;

        const sellable = (result.data?.items || []).filter(
          (item) => !item.status || item.status === "to_sell"
        );
        let stickers = sellable.filter((item) => !item.label_printed);
        if (!stickers.length && product.barcode) {
          stickers = [
            {
              id: "",
              unit_code: product.sku || product.barcode,
              barcode: product.barcode.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
            }
          ];
        }

        const labelSize = product.label_size === "accessory" ? "accessory" : "dress";
        for (const item of stickers) {
          allStickers.push({
            id: item.id,
            unit_code: item.unit_code,
            barcode: item.barcode,
            price: product.price,
            labelSize,
            productName: product.name,
            categoryName: product.subcategory_name || product.category_name || undefined,
            sku: product.sku,
            color: product.color,
            tag: product.tag || undefined,
            sizeLabel: product.color,
            compareAtPrice: product.compare_at_price,
            productId: id
          });
          if (item.id) {
            const list = markByProduct.get(id) || [];
            list.push(item.id);
            markByProduct.set(id, list);
          }
        }
      }

      if (!allStickers.length) {
        throw new Error("No unprinted barcodes on selected products. Receive stock first.");
      }

      await printProductStickers({
        price: allStickers[0].price,
        labelSize: allStickers[0].labelSize,
        items: allStickers
      });

      await Promise.all(
        Array.from(markByProduct.entries()).map(([productId, itemIds]) =>
          adminFetch(`/api/admin/products/${productId}/items`, {
            method: "PATCH",
            json: { itemIds, label_printed: true }
          })
        )
      );

      setPrintMessage(
        `Printed ${allStickers.length} barcode sticker${allStickers.length === 1 ? "" : "s"} for ${selected.size} product${selected.size === 1 ? "" : "s"}.`
      );
      clearSelection();
      await reload();
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : "Could not print barcodes");
    } finally {
      setBulkBusy(false);
    }
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
        eyebrow="Catalogue"
        title="Product Master"
        description="Define what you sell (name, SKU, price, images). Receive and adjust quantities in Inventory."
        actions={
          <>
            <Link
              className="admin-icon-tip"
              href="/admin/inventory"
              data-tooltip="Inventory"
              aria-label="Inventory"
            >
              <Warehouse size={16} strokeWidth={2} />
              <span>Inventory</span>
            </Link>
            <a
              className="admin-icon-tip"
              href="/samples/product-import-sample.xls"
              download="vasritha-product-import-sample.xls"
              data-tooltip="Sample Excel"
              aria-label="Download sample Excel"
            >
              <FileSpreadsheet size={16} strokeWidth={2} />
              <span>Sample Excel</span>
            </a>
            <button
              type="button"
              className="admin-icon-tip"
              disabled={importBusy}
              onClick={() => importInputRef.current?.click()}
              data-tooltip={importBusy ? "Importing…" : "Import bulk data"}
              aria-label="Import bulk data"
            >
              <Upload size={16} strokeWidth={2} />
              <span>{importBusy ? "Importing…" : "Import bulk data"}</span>
            </button>
            <button
              type="button"
              className="admin-icon-tip admin-action-btn--primary"
              onClick={openCreate}
              data-tooltip="New product"
              aria-label="New product"
            >
              <Plus size={17} strokeWidth={2.2} />
              <span>New product</span>
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

      <section className="inv-flow" aria-label="Product master workflow">
        <div className="inv-flow-step is-current">
          <span className="inv-flow-num">1</span>
          <div>
            <strong>Product Master</strong>
            <p>Create / edit catalogue items here.</p>
          </div>
        </div>
        <div className="inv-flow-arrow" aria-hidden>
          →
        </div>
        <div className="inv-flow-step">
          <span className="inv-flow-num">2</span>
          <div>
            <strong>Inventory</strong>
            <p>Receive GRN / adjust on-hand stock.</p>
          </div>
        </div>
        <div className="inv-flow-arrow" aria-hidden>
          →
        </div>
        <div className="inv-flow-step">
          <span className="inv-flow-num">3</span>
          <div>
            <strong>Sell</strong>
            <p>POS &amp; website sell from available stock.</p>
          </div>
        </div>
      </section>

      {(importMessage || importError || printMessage || printError) && (
        <div className="admin-import-feedback">
          {importMessage ? <AdminAlert tone="ok">{importMessage}</AdminAlert> : null}
          {importError ? <AdminAlert>{importError}</AdminAlert> : null}
          {printMessage ? <AdminAlert tone="ok">{printMessage}</AdminAlert> : null}
          {printError ? <AdminAlert>{printError}</AdminAlert> : null}
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
            <button type="button" disabled={bulkBusy} onClick={() => void bulkPrintBarcodes()}>
              <Printer size={14} />
              Print barcodes
            </button>
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
                            {product.parent_name ? (
                              <div className="admin-sub admin-product-relation">
                                Child of {product.parent_name}
                                {product.parent_sku ? ` · ${product.parent_sku}` : ""}
                              </div>
                            ) : Number(product.child_count || 0) > 0 ? (
                              <div className="admin-sub admin-product-relation admin-product-relation--parent">
                                Parent · {product.child_count} design
                                {Number(product.child_count) === 1 ? "" : "s"}
                              </div>
                            ) : null}
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
                      <div className="inv-stock-cell">
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
                        <Link
                          className="admin-action-btn admin-action-btn--compact"
                          href={`/admin/inventory?product=${product.id}`}
                          data-tooltip="Manage stock"
                          aria-label={`Manage stock for ${product.name}`}
                        >
                          <Warehouse size={13} strokeWidth={2} />
                          <span>Stock</span>
                        </Link>
                      </div>
                    </td>
                    <td>
                      <AdminBadge tone={statusTone(product.status)}>{product.status}</AdminBadge>
                    </td>
                    <td>{formatDate(product.created_at)}</td>
                    <td>
                      <div className="admin-row-actions" role="group" aria-label="Product actions">
                        <button
                          type="button"
                          className="admin-action-btn"
                          onClick={() => setDetailId(product.id)}
                          data-tooltip="Details"
                          aria-label={`Details for ${product.name}`}
                        >
                          <Eye size={15} strokeWidth={2} />
                          <span>Details</span>
                        </button>
                        <button
                          type="button"
                          className="admin-action-btn"
                          onClick={() => void openEdit(product.id)}
                          data-tooltip="Edit"
                          aria-label={`Edit ${product.name}`}
                        >
                          <Pencil size={15} strokeWidth={2} />
                          <span>Edit</span>
                        </button>
                        {!product.parent_product_id ? (
                          <button
                            type="button"
                            className="admin-action-btn"
                            onClick={() => openCreateChild(product)}
                            data-tooltip="Add design (child)"
                            aria-label={`Add design under ${product.name}`}
                          >
                            <GitBranchPlus size={15} strokeWidth={2} />
                            <span>Add design</span>
                          </button>
                        ) : null}
                        <Link
                          className="admin-action-btn"
                          href={`/admin/inventory?product=${product.id}`}
                          data-tooltip="Stock"
                          aria-label={`Stock for ${product.name}`}
                        >
                          <Warehouse size={15} strokeWidth={2} />
                          <span>Stock</span>
                        </Link>
                        <button
                          type="button"
                          className="admin-action-btn admin-action-btn--primary"
                          disabled={printBusyId === product.id || bulkBusy}
                          onClick={() => void printBarcodesForProduct(product, "pending")}
                          data-tooltip={printBusyId === product.id ? "Printing…" : "Print barcode"}
                          aria-label={`Print barcodes for ${product.name}`}
                        >
                          <Printer size={15} strokeWidth={2} />
                          <span>{printBusyId === product.id ? "Printing…" : "Barcode"}</span>
                        </button>
                        {product.status === "active" && (
                          <a
                            className="admin-action-btn"
                            href={`/products/${product.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-tooltip="View on storefront"
                            aria-label={`View ${product.name} on storefront`}
                          >
                            <ExternalLink size={15} strokeWidth={2} />
                            <span>View</span>
                          </a>
                        )}
                        {product.status !== "active" && (
                          <button
                            type="button"
                            className="admin-action-btn admin-action-btn--primary"
                            onClick={() => void updateStatus(product.id, "active")}
                            data-tooltip="Publish"
                            aria-label={`Publish ${product.name}`}
                          >
                            <CheckCircle2 size={15} strokeWidth={2} />
                            <span>Publish</span>
                          </button>
                        )}
                        {product.status === "active" && (
                          <button
                            type="button"
                            className="admin-action-btn"
                            onClick={() => void updateStatus(product.id, "draft")}
                            data-tooltip="Unpublish"
                            aria-label={`Unpublish ${product.name}`}
                          >
                            <EyeOff size={15} strokeWidth={2} />
                            <span>Unpublish</span>
                          </button>
                        )}
                        {product.status !== "archived" && (
                          <button
                            type="button"
                            className="admin-action-btn admin-action-btn--danger"
                            onClick={() => void updateStatus(product.id, "archived")}
                            data-tooltip="Archive"
                            aria-label={`Archive ${product.name}`}
                          >
                            <Archive size={15} strokeWidth={2} />
                            <span>Archive</span>
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
        parentOptions={parentOptions}
        initial={formValues}
        initialImages={formImages}
        initialInternalImages={formInternalImages}
        onClose={() => setModalOpen(false)}
        onSaved={() => void reload()}
      />
    </>
  );
}
