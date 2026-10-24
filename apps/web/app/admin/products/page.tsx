"use client";

import { useMemo, useRef, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Filter,
  GitBranchPlus,
  MoreHorizontal,
  Package,
  PackageSearch,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  Warehouse,
  X,
  XCircle
} from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  statusTone
} from "../../../components/admin/admin-ui";
import { AdminPagination, useAdminPageSize } from "../../../components/admin/admin-pagination";
import { ProductDetailModal } from "../../../components/admin/product-detail-modal";
import { adminFetch, formatMoney, getAdminToken, getAdminUser } from "../../../lib/admin-api";
import { downloadAdminExport } from "../../../lib/download-export";
import { useAdminQuery } from "../../../hooks/use-admin-query";
import { productListThumb } from "../../../lib/category-images";

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
  category_slug?: string | null;
  subcategory_name?: string | null;
  primary_image?: string | null;
  short_description?: string;
  short_name?: string;
  color?: string | null;
  is_multicolour?: boolean;
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

type ImportLineError = { row: number; name: string; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function importLineErrorsFromPayload(payload: unknown): ImportLineError[] {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const lists = [root?.errors, root?.failed, data?.errors, data?.failed];
  const raw = lists.find((item) => Array.isArray(item) && item.length) as unknown[] | undefined;
  if (!raw?.length) return [];
  return raw
    .map((item) => {
      const row = asRecord(item);
      const error = String(row?.error || row?.message || "").trim();
      if (!error) return null;
      return {
        row: Number(row?.row || row?.rowNumber || 0),
        name: String(row?.name || "").trim(),
        error
      };
    })
    .filter((item): item is ImportLineError => Boolean(item));
}

function importPayloadMessage(payload: unknown, fallback: string) {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  return String(root?.error || root?.message || data?.error || "").trim() || fallback;
}

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminProductsPageInner />
    </Suspense>
  );
}

function AdminProductsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus") || "";
  const fromGrn = searchParams.get("fromGrn") === "1";
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [featuredFilter, setFeaturedFilter] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useAdminPageSize();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importDialog, setImportDialog] = useState<
    | null
    | {
        kind: "errors";
        summary: string;
        errors: Array<{ row: number; name: string; error: string }>;
      }
    | {
        kind: "confirm";
        fileName: string;
        rowCount: number;
        blankSkuCount: number;
        file: File;
      }
  >(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const focusOpened = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!exportOpen) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.(".pm-export-menu")) setExportOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [exportOpen]);

  const productsPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    return `/api/admin/products?${params.toString()}`;
  }, [debouncedSearch, statusFilter]);

  const { data: products, error, loading, reload } = useAdminQuery<Product[]>(productsPath);
  const { data: categories } = useAdminQuery<Category[]>("/api/admin/categories");
  const canApproveProducts = Boolean(
    getAdminUser()?.permissions?.includes("products:approve") ||
      ["super_admin", "business_owner", "manager"].includes(getAdminUser()?.primaryRole || "")
  );
  const pendingCount = useMemo(
    () => (products || []).filter((row) => row.status === "pending_approval").length,
    [products]
  );

  const colourOptions = useMemo(() => {
    const set = new Set<string>();
    for (const product of products || []) {
      const color = product.color?.trim();
      if (color) set.add(color);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const openCreateChild = (parent: Product) => {
    router.push(`/admin/products/new?parent=${encodeURIComponent(parent.id)}`);
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

  useEffect(() => {
    setPage(0);
  }, [
    search,
    statusFilter,
    categoryFilter,
    subcategoryFilter,
    colorFilter,
    stockFilter,
    featuredFilter,
    priceMin,
    priceMax,
    sortBy,
    pageSize
  ]);

  const paged = useMemo(() => {
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const advancedFilterCount = [
    statusFilter,
    categoryFilter,
    subcategoryFilter,
    colorFilter,
    stockFilter,
    featuredFilter,
    priceMin,
    priceMax
  ].filter(Boolean).length;

  const hasActiveFilters = Boolean(search || advancedFilterCount || sortBy !== "newest");

  const catalogueStats = useMemo(() => {
    const list = products || [];
    let active = 0;
    let low = 0;
    let out = 0;
    let barcodes = 0;
    for (const product of list) {
      if (product.status === "active") active += 1;
      if (product.stock_quantity <= 0) out += 1;
      else if (product.stock_quantity <= LOW_STOCK_THRESHOLD) low += 1;
      barcodes += Number(product.unit_count || 0);
    }
    return { total: list.length, active, low, out, barcodes };
  }, [products]);

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

  useEffect(() => {
    if (!fromGrn) return;
    router.replace("/admin/products/new?fromGrn=1");
  }, [fromGrn, router]);

  useEffect(() => {
    if (!menuOpenId) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".admin-row-more")) return;
      setMenuOpenId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpenId]);

  const openEdit = (productId: string) => {
    router.push(`/admin/products/${productId}/edit`);
  };

  useEffect(() => {
    if (!focusId || focusOpened.current) return;
    focusOpened.current = true;
    router.replace(`/admin/products/${focusId}/edit`);
  }, [focusId, router]);

  const updateStatus = async (id: string, nextStatus: string) => {
    const result = await adminFetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      json: { status: nextStatus }
    });
    if (result.error) {
      window.alert(result.error);
      return;
    }
    await reload();
  };

  const deleteProduct = async (id: string, name: string) => {
    const okConfirm = window.confirm(
      `Permanently delete “${name}”?\n\nThis cannot be undone. Products with sales history cannot be deleted — archive them instead.`
    );
    if (!okConfirm) return;
    const result = await adminFetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (result.error) {
      window.alert(result.error);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await reload();
  };

  const bulkDeleteProducts = async () => {
    if (!selected.size) return;
    const okConfirm = window.confirm(
      `Permanently delete ${selected.size} selected product(s)?\n\nItems with sales history will be skipped.`
    );
    if (!okConfirm) return;
    setBulkBusy(true);
    let failed = 0;
    for (const id of Array.from(selected)) {
      const result = await adminFetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (result.error) failed += 1;
    }
    setBulkBusy(false);
    clearSelection();
    await reload();
    if (failed) {
      window.alert(
        `${failed} product(s) could not be deleted (likely sales history). Archive those instead.`
      );
    }
  };

  const bulkUpdateStatus = async (nextStatus: string) => {
    if (!selected.size) return;
    setBulkBusy(true);
    const result = await adminFetch<{ updatedCount: number }>("/api/admin/products/bulk-status", {
      method: "POST",
      json: { ids: Array.from(selected), status: nextStatus }
    });
    setBulkBusy(false);
    if (result.error) {
      window.alert(result.error);
      return;
    }
    clearSelection();
    await reload();
  };

  const barcodeDeskHref = (productId?: string) =>
    productId ? `/admin/barcodes?product=${encodeURIComponent(productId)}` : "/admin/barcodes";

  const bulkBarcodeHref = useMemo(() => {
    if (selected.size === 1) {
      return barcodeDeskHref(Array.from(selected)[0]);
    }
    return "/admin/barcodes";
  }, [selected]);

  const closeImportDialog = () => {
    setImportDialog(null);
    if (importInputRef.current) importInputRef.current.value = "";
  };

  const runConfirmedImport = async () => {
    if (!importDialog || importDialog.kind !== "confirm") {
      closeImportDialog();
      return;
    }
    const file = importDialog.file;

    setImportBusy(true);
    setImportMessage("");
    try {
      const token = getAdminToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const importBody = new FormData();
      importBody.append("file", file);
      importBody.append("mode", "import");
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        headers,
        body: importBody
      });
      const payload = await res.json().catch(() => ({}));
      const lineErrors = importLineErrorsFromPayload(payload);
      if (!res.ok) {
        const rolledBack = Boolean(asRecord(payload)?.rolledBack);
        const timedOut = res.status === 504 || res.status === 503;
        const serverMessage = timedOut
          ? "The server ran out of time while saving. Your Excel file is fine — this is not a row error. Wait a few seconds and import the same file again."
          : importPayloadMessage(
              payload,
              res.status >= 500
                ? `Server error while saving (HTTP ${res.status})`
                : "Import blocked by validation errors"
            );
        setImportDialog({
          kind: "errors",
          summary: rolledBack ? `${serverMessage} Nothing was saved.` : serverMessage,
          errors: timedOut
            ? []
            : lineErrors.length
              ? lineErrors
              : [
                  {
                    row: 0,
                    name: file.name,
                    error: serverMessage
                  }
                ]
        });
        return;
      }

      const data = (
        payload as {
          data?: {
            created: number;
            updated: number;
            failed: Array<{ name: string; row?: number; error: string }>;
          };
        }
      ).data;

      const failedCount = data?.failed?.length || 0;
      if (failedCount && data?.failed?.length) {
        setImportDialog({
          kind: "errors",
          summary: `Imported with ${failedCount} failure(s). Fix these Excel rows and upload again.`,
          errors: data.failed.map((item) => ({
            row: item.row || 0,
            name: item.name,
            error: item.error
          }))
        });
      } else {
        setImportDialog(null);
      }
      setImportMessage(
        `Imported ${data?.created || 0} new, updated ${data?.updated || 0}${
          failedCount ? `, ${failedCount} failed` : ""
        }.`
      );
      if (importInputRef.current) importInputRef.current.value = "";
      await reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      setImportDialog({
        kind: "errors",
        summary: message,
        errors: [{ row: 0, name: file.name, error: message }]
      });
    } finally {
      setImportBusy(false);
    }
  };

  const onImportFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;

    setImportBusy(true);
    setImportMessage("");
    setImportDialog(null);

    try {
      // Keep a copy — clearing the input must not drop the pending file.
      const fileCopy = new File([await file.arrayBuffer()], file.name, {
        type: file.type || "application/octet-stream"
      });

      const token = getAdminToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      // Validate only — never import until user confirms in the popup.
      const checkBody = new FormData();
      checkBody.append("file", fileCopy);
      checkBody.append("mode", "validate");
      const checkRes = await fetch("/api/admin/products/import", {
        method: "POST",
        headers,
        body: checkBody
      });
      const checkPayload = await checkRes.json().catch(() => ({}));
      const lineErrors = importLineErrorsFromPayload(checkPayload);
      if (!checkRes.ok) {
        const message = importPayloadMessage(
          checkPayload,
          checkRes.status >= 500
            ? `Could not check file (server error ${checkRes.status})`
            : "Could not check file"
        );
        setImportDialog({
          kind: "errors",
          summary: message,
          errors: lineErrors.length
            ? lineErrors
            : [{ row: 1, name: fileCopy.name, error: message }]
        });
        return;
      }

      const checkData = (
        checkPayload as {
          data?: {
            ok?: boolean;
            checked?: number;
            blankSkuCount?: number;
            errors?: Array<{ row: number; name: string; error: string }>;
          };
        }
      ).data;

      const rowCount = Number(checkData?.checked || 0);
      if (!checkData?.ok || lineErrors.length) {
        setImportDialog({
          kind: "errors",
          summary: `File check failed — ${lineErrors.length} error(s) in ${rowCount} row(s). Fix the Excel rows below and upload again. Nothing was imported.`,
          errors: lineErrors
        });
        return;
      }

      // All rows OK → ask before importing (do not import automatically).
      setImportDialog({
        kind: "confirm",
        fileName: fileCopy.name,
        rowCount,
        blankSkuCount: Number(checkData?.blankSkuCount || 0),
        file: fileCopy
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      setImportDialog({
        kind: "errors",
        summary: message,
        errors: [{ row: 0, name: file.name, error: message }]
      });
    } finally {
      setImportBusy(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  return (
    <div className="pm-page">
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Product Master"
        actions={
          <>
            {pendingCount > 0 ? (
              <button
                type="button"
                className="admin-icon-tip"
                onClick={() => {
                  setStatusFilter("pending_approval");
                  setFiltersOpen(true);
                }}
                data-tooltip="Pending approval"
                aria-label={`${pendingCount} products pending approval`}
              >
                <Package size={16} strokeWidth={2} />
                <span>Pending {pendingCount}</span>
              </button>
            ) : null}
            <Link
              className="admin-icon-tip"
              href="/admin/inventory"
              data-tooltip="Inventory"
              aria-label="Inventory"
            >
              <Warehouse size={16} strokeWidth={2} />
            </Link>
            <Link
              className="admin-icon-tip"
              href="/admin/barcodes"
              data-tooltip="Print barcodes"
              aria-label="Print barcodes"
            >
              <Printer size={16} strokeWidth={2} />
            </Link>
            <div className={`pm-export-menu${exportOpen ? " is-open" : ""}`}>
              <button
                type="button"
                className="admin-icon-tip"
                data-tooltip="Export"
                aria-label="Export"
                aria-expanded={exportOpen}
                onClick={() => setExportOpen((v) => !v)}
              >
                <Download size={16} strokeWidth={2} />
              </button>
              {exportOpen ? (
                <div className="pm-export-dropdown" role="menu">
                  {(["xlsx", "csv", "pdf"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setExportOpen(false);
                        void downloadAdminExport(
                          `/api/admin/products/export?format=${fmt}`,
                          `products.${fmt}`
                        ).catch((err) =>
                          window.alert(err instanceof Error ? err.message : "Export failed")
                        );
                      }}
                    >
                      {fmt === "xlsx" ? "Excel (.xlsx)" : fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="admin-icon-tip"
              data-tooltip="Download import template"
              aria-label="Download Excel import template"
              onClick={() => {
                void downloadAdminExport(
                  "/api/admin/products/import/template",
                  "vasritha-product-import-template.xlsx"
                ).catch((err) =>
                  setImportDialog({
                    kind: "errors",
                    summary:
                      err instanceof Error ? err.message : "Could not download template",
                    errors: []
                  })
                );
              }}
            >
              <FileSpreadsheet size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="admin-icon-tip"
              disabled={importBusy}
              onClick={() => importInputRef.current?.click()}
              data-tooltip={importBusy ? "Checking / importing…" : "Import Excel / CSV (validates first)"}
              aria-label="Import bulk data"
            >
              <Upload size={16} strokeWidth={2} />
            </button>
            <Link
              className="admin-icon-tip admin-action-btn--primary"
              href="/admin/products/new"
              data-tooltip="New product"
              aria-label="New product"
            >
              <Plus size={17} strokeWidth={2.2} />
              <span>New product</span>
            </Link>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,.xls,.xlsx,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(e) => void onImportFile(e.target.files)}
            />
          </>
        }
      />

      <div className="pm-stats">
        <button type="button" className="pm-stat" onClick={clearFilters}>
          <span>Products</span>
          <strong>{catalogueStats.total}</strong>
        </button>
        <button
          type="button"
          className="pm-stat pm-stat--ok"
          onClick={() => {
            setStatusFilter("active");
            setStockFilter("");
            setFiltersOpen(true);
          }}
        >
          <span>Active</span>
          <strong>{catalogueStats.active}</strong>
        </button>
        <button
          type="button"
          className="pm-stat pm-stat--warn"
          onClick={() => {
            setStockFilter("low");
            setStatusFilter("");
            setFiltersOpen(true);
          }}
        >
          <span>Low</span>
          <strong>{catalogueStats.low}</strong>
        </button>
        <button
          type="button"
          className="pm-stat pm-stat--danger"
          onClick={() => {
            setStockFilter("out");
            setStatusFilter("");
            setFiltersOpen(true);
          }}
        >
          <span>Out</span>
          <strong>{catalogueStats.out}</strong>
        </button>
        <Link className="pm-stat" href="/admin/barcodes">
          <span>Barcodes</span>
          <strong>{catalogueStats.barcodes}</strong>
        </Link>
      </div>

      {importMessage && !importDialog ? (
        <div className="admin-import-feedback">
          <AdminAlert tone="ok">{importMessage}</AdminAlert>
        </div>
      ) : null}

      {importDialog ? (
        <div
          className="admin-modal-backdrop admin-import-dialog-backdrop"
          role="presentation"
          onClick={() => {
            if (!importBusy) closeImportDialog();
          }}
        >
          <div
            className="admin-modal admin-import-errors-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-errors-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-head">
              <div>
                <h2 id="import-errors-title">
                  {importDialog.kind === "confirm" ? "Confirm import" : "Import errors"}
                </h2>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                aria-label="Close"
                disabled={importBusy}
                onClick={closeImportDialog}
              >
                <X size={18} />
              </button>
            </div>
            <div className="admin-modal-body">
              {importDialog.kind === "confirm" ? (
                <div className="admin-import-confirm">
                  <AdminAlert tone="ok">
                    All {importDialog.rowCount} row(s) are correct.
                  </AdminAlert>
                  <p className="admin-import-confirm__file">
                    File: <strong>{importDialog.fileName}</strong>
                  </p>
                  <p className="admin-import-confirm__count">
                    Do you want to import <strong>{importDialog.rowCount}</strong> product row
                    {importDialog.rowCount === 1 ? "" : "s"} now?
                  </p>
                  {importDialog.blankSkuCount > 0 ? (
                    <p className="muted">
                      {importDialog.blankSkuCount} row
                      {importDialog.blankSkuCount === 1 ? " has" : "s have"} no SKU — a unique
                      code will be created automatically.
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <AdminAlert>{importDialog.summary}</AdminAlert>
                  {importDialog.errors.length > 0 ? (
                    <div className="admin-import-errors">
                      <strong>
                        {importDialog.errors.length} problem
                        {importDialog.errors.length === 1 ? "" : "s"} — Excel row and reason
                      </strong>
                      <div className="admin-import-errors__table-wrap">
                        <table className="admin-import-errors__table">
                          <thead>
                            <tr>
                              <th>Excel row</th>
                              <th>Product</th>
                              <th>What&apos;s wrong</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importDialog.errors.slice(0, 100).map((item, idx) => (
                              <tr key={`${item.row}-${idx}`}>
                                <td className="admin-import-errors__row-no">
                                  {item.row > 1 ? item.row : item.row === 1 ? "1 (header)" : "—"}
                                </td>
                                <td className="admin-import-errors__name">
                                  {item.name || "—"}
                                </td>
                                <td className="admin-import-errors__msg">{item.error}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {importDialog.errors.length > 100 ? (
                        <p className="muted">…and {importDialog.errors.length - 100} more</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="admin-import-errors">
                      <p className="admin-import-errors__msg">
                        No spreadsheet row failed. If saving timed out, import the same file
                        again after a few seconds.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="btn"
                disabled={importBusy}
                onClick={closeImportDialog}
              >
                {importDialog.kind === "confirm" ? "Cancel" : "Close"}
              </button>
              {importDialog.kind === "confirm" ? (
                <button
                  type="button"
                  className="btn admin-modal-primary"
                  disabled={importBusy}
                  onClick={() => void runConfirmedImport()}
                >
                  {importBusy
                    ? "Importing…"
                    : `Import ${importDialog.rowCount} rows`}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="pm-toolbar">
        <div className="admin-search-field pm-toolbar-search">
          <Search size={15} aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, colour, barcode…"
            aria-label="Search products"
          />
          {search ? (
            <button
              type="button"
              className="pm-search-clear"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          className={`pm-filter-toggle${filtersOpen || advancedFilterCount ? " is-active" : ""}`}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <Filter size={15} />
          <span>Filters</span>
          {advancedFilterCount > 0 ? (
            <em className="pm-filter-count">{advancedFilterCount}</em>
          ) : null}
          <ChevronDown size={14} className={filtersOpen ? "is-open" : undefined} />
        </button>

        <label className="pm-sort">
          <span className="sr-only">Sort by</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
            <option value="newest">Newest</option>
            <option value="name">Name A–Z</option>
            <option value="price-asc">Price ↑</option>
            <option value="price-desc">Price ↓</option>
            <option value="stock">Stock ↑</option>
          </select>
        </label>

        {hasActiveFilters ? (
          <button type="button" className="pm-reset" onClick={clearFilters}>
            <RotateCcw size={14} />
            Reset
          </button>
        ) : null}

        <span className="pm-result-count muted">{filtered.length} shown</span>
      </div>

      {filtersOpen ? (
        <div className="admin-filter-panel pm-filter-panel">
          <div className="admin-filter-panel-head">
            <div>
              <strong>Filters</strong>
              <p className="muted">Narrow by status, category, stock, and more</p>
            </div>
            <button
              type="button"
              className="admin-ghost-btn admin-filter-reset"
              onClick={() => setFiltersOpen(false)}
            >
              <X size={14} />
              Close
            </button>
          </div>

          <div className="admin-filter-grid">
            <label>
              <span>Status</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                <option value="pending_approval">Pending approval</option>
                <option value="rejected">Rejected</option>
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
          </div>
        </div>
      ) : null}

      {selected.size > 0 && (
        <div className="admin-bulk-bar">
          <span>
            <b>{selected.size}</b> selected
          </span>
          <div className="admin-bulk-actions">
            <Link
              className="admin-bulk-link admin-icon-tip"
              href={bulkBarcodeHref}
              data-tooltip="Print barcodes"
              aria-label="Print barcodes for selected"
            >
              <Printer size={15} strokeWidth={2} />
              <span>Print barcodes</span>
            </Link>
            {canApproveProducts ? (
              <>
                <button
                  type="button"
                  className="admin-icon-tip"
                  disabled={bulkBusy}
                  onClick={() => void bulkUpdateStatus("active")}
                  data-tooltip="Approve"
                  aria-label="Approve selected"
                >
                  <CheckCircle2 size={15} strokeWidth={2} />
                  <span>Approve</span>
                </button>
                <button
                  type="button"
                  className="admin-icon-tip"
                  disabled={bulkBusy}
                  onClick={() => void bulkUpdateStatus("rejected")}
                  data-tooltip="Reject"
                  aria-label="Reject selected"
                >
                  <XCircle size={15} strokeWidth={2} />
                  <span>Reject</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="admin-icon-tip"
                disabled={bulkBusy}
                onClick={() => void bulkUpdateStatus("pending_approval")}
                data-tooltip="Submit for approval"
                aria-label="Submit selected for approval"
              >
                <CheckCircle2 size={15} strokeWidth={2} />
                <span>Submit for approval</span>
              </button>
            )}
            <button
              type="button"
              className="admin-icon-tip"
              disabled={bulkBusy}
              onClick={() => void bulkUpdateStatus("draft")}
              data-tooltip="Move to draft"
              aria-label="Move selected to draft"
            >
              <EyeOff size={15} strokeWidth={2} />
              <span>Move to draft</span>
            </button>
            <button
              type="button"
              className="admin-icon-tip"
              disabled={bulkBusy}
              onClick={() => void bulkUpdateStatus("archived")}
              data-tooltip="Archive"
              aria-label="Archive selected"
            >
              <Archive size={15} strokeWidth={2} />
              <span>Archive</span>
            </button>
            <button
              type="button"
              className="admin-icon-tip admin-action-btn--danger"
              disabled={bulkBusy}
              onClick={() => void bulkDeleteProducts()}
              data-tooltip="Delete"
              aria-label="Delete selected"
            >
              <Trash2 size={15} strokeWidth={2} />
              <span>Delete</span>
            </button>
            <button
              type="button"
              className="admin-icon-tip admin-bulk-clear"
              onClick={clearSelection}
              data-tooltip="Clear selection"
              aria-label="Clear selection"
            >
              <X size={15} strokeWidth={2} />
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}

      <AdminPanel title="Catalogue">
        {loading && <AdminLoading />}
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
              <button
                type="button"
                className="admin-icon-tip"
                onClick={clearFilters}
                data-tooltip="Reset filters"
                aria-label="Reset filters"
              >
                <RotateCcw size={16} strokeWidth={2} />
                <span>Reset filters</span>
              </button>
            ) : (
              <Link
                className="admin-icon-tip admin-action-btn--primary"
                href="/admin/products/new"
                data-tooltip="New product"
                aria-label="New product"
              >
                <Plus size={17} strokeWidth={2.2} />
                <span>New product</span>
              </Link>
            )}
          </div>
        )}
        {filtered.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra catalogue-table">
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
                  <th>Barcodes</th>
                  <th>Colour</th>
                  <th>Category</th>
                  <th>Selling price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((product) => (
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
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={productListThumb(product.primary_image, product.category_slug)}
                            alt=""
                            className={`admin-product-thumb${product.primary_image ? "" : " admin-product-thumb--placeholder"}`}
                          />
                          <div>
                            <b>{product.name}</b>
                            <div className="muted admin-sub">{product.slug}</div>
                            {product.parent_name ? (
                              <div className="admin-sub admin-product-relation">
                                Child of {product.parent_name}
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
                      <div className="catalogue-code-cell">
                        {product.barcode ? (
                          <strong>{product.barcode}</strong>
                        ) : (
                          <strong>—</strong>
                        )}
                        <Link
                          className="catalogue-barcode-link"
                          href={barcodeDeskHref(product.id)}
                          data-tooltip="Open print desk for this product"
                        >
                          <Printer size={12} strokeWidth={2} />
                          {Number(product.unit_count || 0)} barcodes
                        </Link>
                      </div>
                    </td>
                    <td>
                      {product.is_multicolour ? (
                        <span className="admin-color-cell">Multi-colour</span>
                      ) : product.color ? (
                        <span className="admin-color-cell">
                          <span className="admin-color-dot" style={colorSwatchStyle(product.color)} />
                          {product.color}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <div className="catalogue-category-cell">
                        <span>{product.category_name || "—"}</span>
                        {product.subcategory_name ? (
                          <div className="muted admin-sub">{product.subcategory_name}</div>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="catalogue-price-cell">
                        <strong>{formatMoney(product.price)}</strong>
                        {product.compare_at_price ? (
                          <div className="muted admin-sub strike">{formatMoney(product.compare_at_price)}</div>
                        ) : null}
                      </div>
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
                          onClick={() => openEdit(product.id)}
                          data-tooltip="Edit"
                          aria-label={`Edit ${product.name}`}
                        >
                          <Pencil size={15} strokeWidth={2} />
                          <span>Edit</span>
                        </button>
                        <Link
                          className="admin-action-btn admin-action-btn--primary"
                          href={barcodeDeskHref(product.id)}
                          data-tooltip="Print barcodes"
                          aria-label={`Print barcodes for ${product.name}`}
                        >
                          <Printer size={15} strokeWidth={2} />
                          <span>Barcode</span>
                        </Link>
                        <Link
                          className="admin-action-btn"
                          href={`/admin/inventory?product=${product.id}`}
                          data-tooltip="Stock"
                          aria-label={`Stock for ${product.name}`}
                        >
                          <Warehouse size={15} strokeWidth={2} />
                          <span>Stock</span>
                        </Link>
                        <div className={`admin-row-more${menuOpenId === product.id ? " is-open" : ""}`}>
                          <button
                            type="button"
                            className="admin-action-btn"
                            data-tooltip="More actions"
                            aria-label={`More actions for ${product.name}`}
                            aria-expanded={menuOpenId === product.id}
                            onClick={() =>
                              setMenuOpenId((current) => (current === product.id ? null : product.id))
                            }
                          >
                            <MoreHorizontal size={15} strokeWidth={2} />
                            <span>More</span>
                          </button>
                          {menuOpenId === product.id ? (
                            <div className="admin-row-more-menu" role="menu">
                              {!product.parent_product_id ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    openCreateChild(product);
                                  }}
                                >
                                  <GitBranchPlus size={14} />
                                  Add design
                                </button>
                              ) : null}
                              {product.status === "active" ? (
                                <a
                                  role="menuitem"
                                  href={`/products/${product.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => setMenuOpenId(null)}
                                >
                                  <ExternalLink size={14} />
                                  Storefront
                                </a>
                              ) : null}
                              {product.status === "pending_approval" && canApproveProducts ? (
                                <>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setMenuOpenId(null);
                                      void updateStatus(product.id, "active");
                                    }}
                                  >
                                    <CheckCircle2 size={14} />
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="is-danger"
                                    onClick={() => {
                                      setMenuOpenId(null);
                                      void updateStatus(product.id, "rejected");
                                    }}
                                  >
                                    <XCircle size={14} />
                                    Reject
                                  </button>
                                </>
                              ) : null}
                              {(product.status === "rejected" || product.status === "draft") &&
                              !canApproveProducts ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    void updateStatus(product.id, "pending_approval");
                                  }}
                                >
                                  <CheckCircle2 size={14} />
                                  Resubmit for approval
                                </button>
                              ) : null}
                              {product.status !== "active" &&
                              product.status !== "pending_approval" &&
                              canApproveProducts ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    void updateStatus(product.id, "active");
                                  }}
                                >
                                  <CheckCircle2 size={14} />
                                  Approve / Publish
                                </button>
                              ) : null}
                              {product.status === "active" ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    void updateStatus(product.id, "draft");
                                  }}
                                >
                                  <EyeOff size={14} />
                                  Unpublish
                                </button>
                              ) : null}
                              {product.status !== "archived" ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    void updateStatus(product.id, "archived");
                                  }}
                                >
                                  <Archive size={14} />
                                  Archive
                                </button>
                              ) : null}
                              <button
                                type="button"
                                role="menuitem"
                                className="is-danger"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  void deleteProduct(product.id, product.name);
                                }}
                              >
                                <Trash2 size={14} />
                                Delete permanently
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <AdminPagination
              page={page}
              total={filtered.length}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              noun="products"
            />
          </div>
        )}
      </AdminPanel>

      <ProductDetailModal
        productId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(id) => {
          setDetailId(null);
          openEdit(id);
        }}
      />
    </div>
  );
}
