"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ClipboardCheck,
  FilePlus2,
  PackagePlus,
  Plus,
  Printer,
  Search,
  Trash2,
  Truck,
  X
} from "lucide-react";
import {
  AdminAlert,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../../components/admin/admin-ui";
import { ColorField } from "../../../../components/admin/color-field";
import {
  ProductPickModal,
  type ProductPickRow
} from "../../../../components/admin/product-pick-modal";
import {
  adminFetch,
  adminUpload,
  formatMoney,
  getAdminUser
} from "../../../../lib/admin-api";
import {
  blankColorSplit,
  blankGrnDraft,
  clearGrnDraft,
  colorSplitsQty,
  draftGrandTotal,
  draftLinesTotal,
  lineTotal,
  loadGrnDraft,
  saveGrnDraft,
  type GrnDraft,
  type GrnDraftLine
} from "../../../../lib/grn-draft";
import { useAdminQuery } from "../../../../hooks/use-admin-query";

type StockRow = ProductPickRow;

type Supplier = {
  id: string;
  code: string;
  name: string;
  trade_name: string | null;
  gstin: string | null;
  pan: string | null;
  state: string | null;
  state_code: string | null;
  phone: string | null;
};

function GrnEntryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeGrn = searchParams.get("resumeGrn") === "1";
  const resumeVariant = searchParams.get("newVariant") || "";
  const prefillVariant = searchParams.get("variant") || "";

  const sessionShopId = getAdminUser()?.shopId || null;

  const inventoryPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (sessionShopId) params.set("shopId", sessionShopId);
    return `/api/admin/inventory?${params.toString()}`;
  }, [sessionShopId]);

  const { data, loading, error, reload } = useAdminQuery<{ stock: StockRow[] }>(inventoryPath);
  const { data: suppliers, reload: reloadSuppliers } = useAdminQuery<Supplier[]>(
    "/api/admin/suppliers?active=1"
  );

  const canApprove = Boolean(
    getAdminUser()?.permissions?.includes("stock:approve") ||
      ["super_admin", "business_owner", "manager"].includes(getAdminUser()?.primaryRole || "")
  );

  const [inward, setInward] = useState<GrnDraft>(() => blankGrnDraft());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<number | null>(null);
  const [pickedByVariant, setPickedByVariant] = useState<Record<string, ProductPickRow>>({});

  useEffect(() => {
    // Resume only when returning from Product Master with a new variant.
    if (resumeGrn) {
      const draft = loadGrnDraft();
      if (draft) {
        const next = { ...draft };
        if (resumeVariant) {
          const idx = Math.min(Math.max(next.focusLineIndex, 0), next.lines.length - 1);
          const lines = [...next.lines];
          lines[idx] = { ...lines[idx], productVariantId: resumeVariant, searchHint: undefined };
          next.lines = lines;
          next.focusLineIndex = idx;
          saveGrnDraft(next);
        }
        setInward(next);
        setHydrated(true);
        return;
      }
    }
    // Always open a blank GRN — no “continue draft” banner.
    clearGrnDraft();
    setInward(blankGrnDraft(prefillVariant || ""));
    setHydrated(true);
  }, [resumeGrn, resumeVariant, prefillVariant]);

  useEffect(() => {
    if (!data?.stock?.length) return;
    setPickedByVariant((prev) => {
      const next = { ...prev };
      for (const line of inward.lines) {
        if (!line.productVariantId || next[line.productVariantId]) continue;
        const row = data.stock.find((s) => s.variant_id === line.productVariantId);
        if (row) next[line.productVariantId] = row;
      }
      return next;
    });
  }, [data?.stock, inward.lines]);

  const startNewGrn = () => {
    clearGrnDraft();
    setInward(blankGrnDraft());
    setFormError("");
    setPickerOpen(null);
    if (resumeGrn || resumeVariant || prefillVariant) {
      router.replace("/admin/inventory/grn");
    }
  };
  const closeSkuPicker = () => setPickerOpen(null);

  const openSkuPicker = (index: number) => setPickerOpen(index);

  const resolveStock = (variantId: string) =>
    pickedByVariant[variantId] ||
    (data?.stock || []).find((s) => s.variant_id === variantId) ||
    null;

  const chooseSku = (row: ProductPickRow) => {
    if (pickerOpen == null) return;
    const lines = [...inward.lines];
    const current = lines[pickerOpen];
    const next: GrnDraftLine = {
      ...current,
      productVariantId: row.variant_id,
      colorSplits: row.is_multicolour
        ? current.colorSplits?.length
          ? current.colorSplits
          : [blankColorSplit()]
        : undefined
    };
    if (next.colorSplits?.length) {
      const splitSum = colorSplitsQty(next.colorSplits);
      if (splitSum > 0) next.quantity = String(splitSum);
    }
    lines[pickerOpen] = next;
    setPickedByVariant((prev) => ({ ...prev, [row.variant_id]: row }));
    persistDraft({ ...inward, lines });
    closeSkuPicker();
  };

  const clearSku = (index: number) => {
    updateLine(index, { productVariantId: "", colorSplits: undefined });
  };

  const linesTotal = useMemo(() => draftLinesTotal(inward.lines), [inward.lines]);
  const grandTotal = useMemo(
    () => draftGrandTotal(inward.lines, inward.discountAmount, inward.taxAmount),
    [inward.lines, inward.discountAmount, inward.taxAmount]
  );
  const selectedSupplier = useMemo(
    () => (suppliers || []).find((row) => row.id === inward.supplierId) || null,
    [suppliers, inward.supplierId]
  );

  const persistDraft = (next: GrnDraft) => {
    setInward(next);
    saveGrnDraft(next);
  };

  const updateLine = (index: number, patch: Partial<GrnDraftLine>) => {
    const lines = [...inward.lines];
    let next = { ...lines[index], ...patch };

    if ("productVariantId" in patch) {
      const row = patch.productVariantId ? resolveStock(patch.productVariantId) : null;
      if (row?.is_multicolour) {
        next = {
          ...next,
          colorSplits: next.colorSplits?.length ? next.colorSplits : [blankColorSplit()]
        };
      } else {
        next = { ...next, colorSplits: undefined };
      }
    }

    if (next.colorSplits?.length) {
      const splitSum = colorSplitsQty(next.colorSplits);
      if (splitSum > 0) next = { ...next, quantity: String(splitSum) };
    }

    lines[index] = next;
    persistDraft({ ...inward, lines });
  };

  const updateColorSplit = (
    lineIndex: number,
    splitIndex: number,
    patch: Partial<{ color: string; quantity: string }>
  ) => {
    const line = inward.lines[lineIndex];
    if (!line?.colorSplits) return;
    const splits = line.colorSplits.map((s, i) => (i === splitIndex ? { ...s, ...patch } : s));
    updateLine(lineIndex, { colorSplits: splits });
  };

  const onInvoiceDocument = async (file: File | null) => {
    if (!file) {
      persistDraft({ ...inward, documentPath: "", documentName: "" });
      return;
    }
    setDocUploading(true);
    setFormError("");
    const form = new FormData();
    form.append("file", file);
    const result = await adminUpload<{ path: string }>("/api/admin/inventory/grn/document", form);
    setDocUploading(false);
    if (result.error || !result.data?.path) {
      setFormError(result.error || "Could not upload invoice document");
      return;
    }
    persistDraft({
      ...inward,
      documentPath: result.data.path,
      documentName: file.name
    });
  };

  const goCreateMissingProduct = () => {
    const emptyIdx = inward.lines.findIndex((line) => !line.productVariantId);
    const idx = emptyIdx >= 0 ? emptyIdx : Math.max(0, inward.lines.length - 1);
    const next: GrnDraft = { ...inward, focusLineIndex: idx };
    saveGrnDraft(next);
    window.location.href = "/admin/products?fromGrn=1";
  };

  const submitGrn = async (approveNow = false) => {
    setSaving(true);
    setFormError("");

    for (const line of inward.lines) {
      if (!line.productVariantId) {
        setSaving(false);
        setFormError("Select a SKU / variant on every line, or create the missing product.");
        return;
      }
      if (!Number.isFinite(Number(line.purchasePrice)) || Number(line.purchasePrice) < 0) {
        setSaving(false);
        setFormError("Enter purchase price for every line.");
        return;
      }
      const stockRow = resolveStock(line.productVariantId);
      if (stockRow?.is_multicolour) {
        const splits = (line.colorSplits || []).filter(
          (s) => s.color.trim() && Number(s.quantity) > 0
        );
        if (!splits.length) {
          setSaving(false);
          setFormError(
            `${stockRow.product_name} is multi-colour — enter colour-wise quantities on that line.`
          );
          return;
        }
        const splitSum = colorSplitsQty(splits);
        if (splitSum !== Math.trunc(Number(line.quantity) || 0)) {
          setSaving(false);
          setFormError(
            `${stockRow.product_name}: colour quantities (${splitSum}) must equal line qty (${Math.trunc(Number(line.quantity) || 0)}).`
          );
          return;
        }
      }
    }

    if (!inward.supplierId) {
      setSaving(false);
      setFormError("Select a supplier from Supplier Master.");
      return;
    }

    const invoiceAmount = Number(inward.invoiceAmount);
    if (!Number.isFinite(invoiceAmount) || invoiceAmount < 0) {
      setSaving(false);
      setFormError("Enter invoice amount.");
      return;
    }

    const discountAmount = Number(inward.discountAmount || 0);
    const taxAmount = Number(inward.taxAmount || 0);
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      setSaving(false);
      setFormError("Discount must be zero or a positive amount.");
      return;
    }
    if (!Number.isFinite(taxAmount) || taxAmount < 0) {
      setSaving(false);
      setFormError("Tax must be zero or a positive amount.");
      return;
    }
    if (discountAmount > linesTotal + 0.001) {
      setSaving(false);
      setFormError("Discount cannot exceed lines total.");
      return;
    }

    if (approveNow) {
      const okConfirm = window.confirm(
        "Submit and approve this GRN now? Stock will update immediately."
      );
      if (!okConfirm) {
        setSaving(false);
        return;
      }
    }

    const result = await adminFetch<{
      id?: string;
      grn_number?: string;
      status?: string;
      pending?: boolean;
      count?: number;
      units?: number;
      message?: string;
      approveError?: string;
    }>("/api/admin/inventory/inward", {
      method: "POST",
      json: {
        supplierId: inward.supplierId,
        billNo: inward.billNo || undefined,
        note: inward.note || undefined,
        invoiceAmount,
        invoiceDate: inward.invoiceDate || undefined,
        documentPath: inward.documentPath || undefined,
        discountAmount,
        taxAmount,
        approveNow: approveNow || undefined,
        shopId: sessionShopId || undefined,
        lines: inward.lines.map((line) => {
          const stockRow = resolveStock(line.productVariantId);
          const colorBreakdown =
            stockRow?.is_multicolour && line.colorSplits?.length
              ? line.colorSplits
                  .map((s) => ({
                    color: s.color.trim(),
                    quantity: Math.trunc(Number(s.quantity) || 0)
                  }))
                  .filter((s) => s.color && s.quantity > 0)
              : undefined;
          return {
            productVariantId: line.productVariantId,
            quantity: Number(line.quantity),
            purchasePrice: Number(line.purchasePrice),
            colorBreakdown
          };
        })
      }
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }

    clearGrnDraft();
    setInward(blankGrnDraft());
    // Don't await inventory reload — it was adding seconds after a successful save.
    void reload();

    if (result.data?.pending) {
      router.push("/admin/inventory/approvals?submitted=1");
      return;
    }

    router.push(
      `/admin/barcodes?grn=${encodeURIComponent(result.data?.grn_number || "")}`
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitGrn(false);
  };

  if (!hydrated) return <AdminLoading />;

  return (
    <>
      <AdminPageHeader
        eyebrow="Inventory"
        title="New GRN"
        description="Receive supplier stock. Multi-colour SKUs need colour-wise quantities before submit."
        actions={
          <>
            <button
              type="button"
              className="admin-icon-tip admin-action-btn--primary"
              onClick={startNewGrn}
              data-tooltip="Clear draft and start blank GRN"
              aria-label="New GRN"
            >
              <FilePlus2 size={16} strokeWidth={2} />
              <span>New GRN</span>
            </button>
            <Link className="admin-icon-tip" href="/admin/inventory">
              <ArrowLeft size={16} strokeWidth={2} />
              <span>Back to inventory</span>
            </Link>
            <Link className="admin-icon-tip" href="/admin/inventory/approvals">
              <ClipboardCheck size={16} strokeWidth={2} />
              <span>GRN approvals</span>
            </Link>
            <Link className="admin-icon-tip" href="/admin/barcodes">
              <Printer size={16} strokeWidth={2} />
              <span>Print barcodes</span>
            </Link>
            <Link className="admin-icon-tip" href="/admin/suppliers">
              <Truck size={16} strokeWidth={2} />
              <span>Supplier Master</span>
            </Link>
            <Link className="admin-icon-tip" href="/admin/products">
              <PackagePlus size={16} strokeWidth={2} />
              <span>Product Master</span>
            </Link>
          </>
        }
      />

      {error && <AdminAlert>{error}</AdminAlert>}
      {formError && <AdminAlert>{formError}</AdminAlert>}

      <form className="grn-page" onSubmit={onSubmit}>
        <AdminPanel title="Supplier & invoice">
          <div className="grn-grid">
            <label className="grn-span-2">
              <span>Supplier *</span>
              <select
                required
                value={inward.supplierId}
                onChange={(e) =>
                  persistDraft({
                    ...inward,
                    supplierId: e.target.value,
                    supplier: ""
                  })
                }
              >
                <option value="">Select supplier</option>
                {(suppliers || []).map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                    {row.trade_name ? ` (${row.trade_name})` : ""} · {row.code}
                    {row.gstin ? ` · ${row.gstin}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {selectedSupplier ? (
              <div className="grn-supplier-row">
                <div className="grn-supplier-meta">
                  <span>GSTIN: {selectedSupplier.gstin || "—"}</span>
                  <span>PAN: {selectedSupplier.pan || "—"}</span>
                  <span>
                    {selectedSupplier.state || "—"}
                    {selectedSupplier.state_code ? ` (${selectedSupplier.state_code})` : ""}
                  </span>
                  {selectedSupplier.phone ? <span>{selectedSupplier.phone}</span> : null}
                </div>
                <button type="button" className="btn admin-ghost-btn" onClick={() => void reloadSuppliers()}>
                  Refresh list
                </button>
              </div>
            ) : (
              <p className="grn-span-2 muted">
                No supplier listed?{" "}
                <Link href="/admin/suppliers" target="_blank">
                  Create in Supplier Master
                </Link>
                , then refresh.
              </p>
            )}

            <label>
              <span>Bill / invoice no.</span>
              <input
                value={inward.billNo}
                onChange={(e) => persistDraft({ ...inward, billNo: e.target.value })}
                placeholder="Optional"
              />
            </label>
            <label>
              <span>Invoice date</span>
              <input
                type="date"
                value={inward.invoiceDate}
                onChange={(e) => persistDraft({ ...inward, invoiceDate: e.target.value })}
              />
            </label>
            <label>
              <span>Invoice amount (₹) *</span>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={inward.invoiceAmount}
                onChange={(e) => persistDraft({ ...inward, invoiceAmount: e.target.value })}
                placeholder="As on supplier bill"
              />
            </label>
            <label>
              <span>Discount (₹)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={inward.discountAmount}
                onChange={(e) => persistDraft({ ...inward, discountAmount: e.target.value })}
                placeholder="0"
              />
            </label>
            <label>
              <span>Tax (₹)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={inward.taxAmount}
                onChange={(e) => persistDraft({ ...inward, taxAmount: e.target.value })}
                placeholder="0"
              />
            </label>
            <label>
              <span>Lines total (auto)</span>
              <input readOnly value={formatMoney(linesTotal)} />
            </label>
            <label>
              <span>Grand total (auto)</span>
              <input readOnly value={formatMoney(grandTotal)} />
            </label>
            <label className="grn-span-2">
              <span>Invoice document (PDF / image)</span>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={docUploading}
                onChange={(e) => void onInvoiceDocument(e.target.files?.[0] || null)}
              />
              {docUploading ? <small>Uploading…</small> : null}
              {!docUploading && inward.documentPath ? (
                <small>Attached: {inward.documentName || inward.documentPath}</small>
              ) : null}
              {inward.documentPath ? (
                <div className="grn-doc-actions">
                  <button
                    type="button"
                    className="btn admin-ghost-btn"
                    onClick={() => persistDraft({ ...inward, documentPath: "", documentName: "" })}
                  >
                    Remove document
                  </button>
                </div>
              ) : null}
            </label>
            <label>
              <span>Note</span>
              <input
                value={inward.note}
                onChange={(e) => persistDraft({ ...inward, note: e.target.value })}
                placeholder="Optional remark"
              />
            </label>
          </div>
        </AdminPanel>

        <AdminPanel
          title="Lines"
          actions={
            <div className="grn-line-actions">
              <button type="button" className="btn admin-ghost-btn" onClick={goCreateMissingProduct}>
                <PackagePlus size={15} />
                New SKU
              </button>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  persistDraft({
                    ...inward,
                    lines: [
                      ...inward.lines,
                      { productVariantId: "", quantity: "1", purchasePrice: "" }
                    ]
                  })
                }
              >
                <Plus size={15} />
                Add line
              </button>
            </div>
          }
        >
          {loading && <AdminLoading />}

          <div className="grn-lines">
            <div className="grn-line grn-line--head" aria-hidden>
              <span>Product</span>
              <span>Qty</span>
              <span>Purchase ₹</span>
              <span>Line total</span>
              <span />
            </div>
            {inward.lines.map((line, index) => {
              const total = lineTotal(line.quantity, line.purchasePrice);
              const stockRow = line.productVariantId ? resolveStock(line.productVariantId) : null;
              const isMulti = Boolean(stockRow?.is_multicolour);
              const splits = line.colorSplits || [];
              const splitSum = colorSplitsQty(splits);
              const lineQty = Math.trunc(Number(line.quantity) || 0);
              const splitOk = !isMulti || (splitSum > 0 && splitSum === lineQty);
              return (
                <div
                  className={`grn-line${isMulti ? " grn-line--multicolour" : ""}`}
                  key={`grn-line-${index}`}
                >
                  <div className="grn-sku-field">
                    <span className="grn-mobile-label">Product</span>

                    {stockRow ? (
                      <div className="grn-sku-chip">
                        <div className="grn-sku-chip-copy">
                          <strong>{stockRow.product_name}</strong>
                          <span>
                            {stockRow.is_multicolour
                              ? "Multi-colour"
                              : stockRow.product_color || "—"}
                            {" · "}
                            {stockRow.sku || "no-sku"}
                            {" · "}
                            On hand {stockRow.stock_quantity}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="grn-sku-chip-change"
                          onClick={() => openSkuPicker(index)}
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          className="grn-sku-chip-clear"
                          aria-label="Clear product"
                          onClick={() => clearSku(index)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="grn-sku-open"
                        onClick={() => openSkuPicker(index)}
                      >
                        <Search size={16} aria-hidden />
                        <span>Select product…</span>
                      </button>
                    )}

                    <input
                      tabIndex={-1}
                      aria-hidden
                      className="grn-sku-required"
                      required
                      value={line.productVariantId}
                      onChange={() => undefined}
                    />
                  </div>
                  <label>
                    <span className="grn-mobile-label">Qty</span>
                    <input
                      required
                      type="number"
                      min={1}
                      step={1}
                      value={line.quantity}
                      readOnly={isMulti}
                      onChange={(e) => updateLine(index, { quantity: e.target.value })}
                      title={isMulti ? "Qty is the sum of colour counts below" : undefined}
                    />
                  </label>
                  <label>
                    <span className="grn-mobile-label">Purchase ₹</span>
                    <input
                      required
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.purchasePrice}
                      onChange={(e) => updateLine(index, { purchasePrice: e.target.value })}
                      placeholder="Unit cost"
                    />
                  </label>
                  <label>
                    <span className="grn-mobile-label">Line total</span>
                    <input readOnly value={formatMoney(total)} />
                  </label>
                  <button
                    type="button"
                    className="admin-action-btn"
                    disabled={inward.lines.length <= 1}
                    onClick={() =>
                      persistDraft({
                        ...inward,
                        lines: inward.lines.filter((_, i) => i !== index)
                      })
                    }
                    aria-label="Remove line"
                  >
                    <Trash2 size={15} />
                    <span>Remove</span>
                  </button>

                  {isMulti ? (
                    <div className={`grn-color-splits${splitOk ? "" : " is-mismatch"}`}>
                      <div className="grn-color-splits-head">
                        <strong>Colour-wise qty</strong>
                        <span className={splitOk ? "muted" : "grn-split-warn"}>
                          Sum {splitSum} / line {lineQty}
                          {!splitOk ? " — must match" : ""}
                        </span>
                      </div>
                      {splits.map((split, splitIndex) => (
                        <div className="grn-color-split" key={`split-${index}-${splitIndex}`}>
                          <ColorField
                            id={`grn-colour-${index}-${splitIndex}`}
                            value={split.color}
                            onChange={(color) => updateColorSplit(index, splitIndex, { color })}
                            required
                          />
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={split.quantity}
                            onChange={(e) =>
                              updateColorSplit(index, splitIndex, { quantity: e.target.value })
                            }
                            placeholder="Qty"
                            required
                          />
                          <button
                            type="button"
                            className="admin-action-btn"
                            disabled={splits.length <= 1}
                            onClick={() =>
                              updateLine(index, {
                                colorSplits: splits.filter((_, i) => i !== splitIndex)
                              })
                            }
                            aria-label="Remove colour"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn admin-ghost-btn"
                        onClick={() =>
                          updateLine(index, {
                            colorSplits: [...splits, blankColorSplit()]
                          })
                        }
                      >
                        <Plus size={14} />
                        Add colour
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </AdminPanel>

        <div className="grn-footer">
          <div className="grn-footer-totals">
            <span>Lines</span>
            <strong>{formatMoney(linesTotal)}</strong>
            <span>Discount</span>
            <strong>-{formatMoney(Number(inward.discountAmount) || 0)}</strong>
            <span>Tax</span>
            <strong>{formatMoney(Number(inward.taxAmount) || 0)}</strong>
            <span>Grand</span>
            <strong>{formatMoney(grandTotal)}</strong>
            <span>Invoice</span>
            <strong>
              {inward.invoiceAmount ? formatMoney(Number(inward.invoiceAmount) || 0) : "—"}
            </strong>
          </div>
          <div className="grn-footer-actions">
            <button type="button" className="btn admin-ghost-btn" onClick={startNewGrn}>
              New GRN
            </button>
            <Link className="btn admin-ghost-btn" href="/admin/inventory">
              Cancel
            </Link>
            <button type="submit" className="btn" disabled={saving || loading}>
              {saving ? "Submitting…" : "Submit for approval"}
            </button>
            {canApprove ? (
              <button
                type="button"
                className="btn"
                disabled={saving || loading}
                onClick={() => void submitGrn(true)}
              >
                {saving ? "Working…" : "Submit & approve"}
              </button>
            ) : null}
          </div>
        </div>
      </form>

      <ProductPickModal
        open={pickerOpen != null}
        onClose={closeSkuPicker}
        onSelect={chooseSku}
        onCreateProduct={() => {
          closeSkuPicker();
          goCreateMissingProduct();
        }}
      />
    </>
  );
}

export default function AdminGrnEntryPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <GrnEntryPageInner />
    </Suspense>
  );
}
