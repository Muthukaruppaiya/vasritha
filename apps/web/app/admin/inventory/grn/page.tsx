"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, PackagePlus, Plus, Printer, Trash2, Truck } from "lucide-react";
import {
  AdminAlert,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../../components/admin/admin-ui";
import { adminFetch, formatMoney } from "../../../../lib/admin-api";
import {
  blankGrnDraft,
  clearGrnDraft,
  draftLinesTotal,
  lineTotal,
  loadGrnDraft,
  saveGrnDraft,
  type GrnDraft,
  type GrnDraftLine
} from "../../../../lib/grn-draft";
import { useAdminQuery } from "../../../../hooks/use-admin-query";

type StockRow = {
  variant_id: string;
  sku: string | null;
  variant_name: string | null;
  stock_quantity: number;
  product_name: string;
};

type InventoryData = {
  stock: StockRow[];
};

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

function GrnPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeGrn = searchParams.get("resumeGrn") === "1";
  const resumeVariant = searchParams.get("newVariant") || "";
  const prefillVariant = searchParams.get("variant") || "";

  const { data, loading, error, reload } = useAdminQuery<InventoryData>("/api/admin/inventory");
  const { data: suppliers, reload: reloadSuppliers } = useAdminQuery<Supplier[]>(
    "/api/admin/suppliers?active=1"
  );

  const [inward, setInward] = useState<GrnDraft>(() => blankGrnDraft());
  const [skuFilter, setSkuFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [draftBanner, setDraftBanner] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const draft = loadGrnDraft();
    if (resumeGrn && draft) {
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
      setDraftBanner("Draft restored — continue your GRN.");
    } else if (prefillVariant) {
      setInward(blankGrnDraft(prefillVariant));
    } else if (draft) {
      setInward(draft);
      setDraftBanner("Resumed saved GRN draft.");
    }
    setHydrated(true);
  }, [resumeGrn, resumeVariant, prefillVariant]);

  const skuSelectOptions = useMemo(() => {
    const list = data?.stock || [];
    const q = skuFilter.trim().toLowerCase();
    const selectedIds = new Set(inward.lines.map((line) => line.productVariantId).filter(Boolean));
    if (!q) return list;
    return list.filter((row) => {
      if (selectedIds.has(row.variant_id)) return true;
      const hay = [row.product_name, row.sku, row.variant_name].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [data?.stock, skuFilter, inward.lines]);

  const filteredOnly = useMemo(() => {
    const q = skuFilter.trim().toLowerCase();
    if (!q) return data?.stock || [];
    return (data?.stock || []).filter((row) => {
      const hay = [row.product_name, row.sku, row.variant_name].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [data?.stock, skuFilter]);

  const linesTotal = useMemo(() => draftLinesTotal(inward.lines), [inward.lines]);
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
    lines[index] = { ...lines[index], ...patch };
    persistDraft({ ...inward, lines });
  };

  const goCreateMissingProduct = () => {
    const emptyIdx = inward.lines.findIndex((line) => !line.productVariantId);
    const idx = emptyIdx >= 0 ? emptyIdx : Math.max(0, inward.lines.length - 1);
    const lines = [...inward.lines];
    lines[idx] = {
      ...lines[idx],
      searchHint: skuFilter.trim() || lines[idx].searchHint
    };
    const next: GrnDraft = { ...inward, lines, focusLineIndex: idx };
    saveGrnDraft(next);
    setDraftBanner("GRN saved as draft. Create the product, then return here.");
    window.location.href = "/admin/products?fromGrn=1";
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
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

    const result = await adminFetch("/api/admin/inventory/inward", {
      method: "POST",
      json: {
        supplierId: inward.supplierId,
        billNo: inward.billNo || undefined,
        note: inward.note || undefined,
        invoiceAmount,
        lines: inward.lines.map((line) => ({
          productVariantId: line.productVariantId,
          quantity: Number(line.quantity),
          purchasePrice: Number(line.purchasePrice)
        }))
      }
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    clearGrnDraft();
    router.push("/admin/barcodes");
  };

  if (!hydrated) return <AdminLoading />;

  return (
    <>
      <AdminPageHeader
        eyebrow="Step 2 · Inventory"
        title="Receive stock (GRN)"
        description="Post supplier inward with purchase price and invoice amount. Draft is saved automatically."
        actions={
          <>
            <Link className="admin-icon-tip" href="/admin/inventory">
              <ArrowLeft size={16} strokeWidth={2} />
              <span>Back to inventory</span>
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
      {draftBanner && <AdminAlert tone="ok">{draftBanner}</AdminAlert>}

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
              <div className="grn-span-2 grn-supplier-meta">
                <span>GSTIN: {selectedSupplier.gstin || "—"}</span>
                <span>PAN: {selectedSupplier.pan || "—"}</span>
                <span>
                  {selectedSupplier.state || "—"}
                  {selectedSupplier.state_code ? ` (${selectedSupplier.state_code})` : ""}
                </span>
                {selectedSupplier.phone ? <span>{selectedSupplier.phone}</span> : null}
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
              <span>Lines total (auto)</span>
              <input readOnly value={formatMoney(linesTotal)} />
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
              <button
                type="button"
                className="btn admin-ghost-btn"
                onClick={goCreateMissingProduct}
              >
                <PackagePlus size={15} />
                New SKU
              </button>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  persistDraft({
                    ...inward,
                    lines: [...inward.lines, { productVariantId: "", quantity: "1", purchasePrice: "" }]
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

          <div className="grn-toolbar">
            <label>
              <span>Search SKU / part in list</span>
              <input
                value={skuFilter}
                onChange={(e) => setSkuFilter(e.target.value)}
                placeholder="Type to filter variants…"
              />
            </label>
            {skuFilter.trim() && filteredOnly.length === 0 ? (
              <div className="grn-missing">
                <p>
                  No SKU matches “{skuFilter.trim()}”. Create it in Product Master — this GRN stays as a
                  draft.
                </p>
                <button type="button" className="btn" onClick={goCreateMissingProduct}>
                  Create product
                </button>
              </div>
            ) : null}
          </div>

          <div className="grn-lines">
            <div className="grn-line grn-line--head" aria-hidden>
              <span>SKU / variant</span>
              <span>Qty</span>
              <span>Purchase ₹</span>
              <span>Line total</span>
              <span />
            </div>
            {inward.lines.map((line, index) => {
              const total = lineTotal(line.quantity, line.purchasePrice);
              return (
                <div className="grn-line" key={`grn-line-${index}`}>
                  <label>
                    <span className="grn-mobile-label">SKU / variant</span>
                    <select
                      required
                      value={line.productVariantId}
                      onChange={(e) => updateLine(index, { productVariantId: e.target.value })}
                    >
                      <option value="">Select SKU / variant</option>
                      {skuSelectOptions.map((row) => (
                        <option key={`${row.variant_id}-${index}`} value={row.variant_id}>
                          {row.product_name} · {row.sku || "no-sku"} · on hand {row.stock_quantity}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="grn-mobile-label">Qty</span>
                    <input
                      required
                      type="number"
                      min={1}
                      step={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: e.target.value })}
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
                </div>
              );
            })}
          </div>
        </AdminPanel>

        <div className="grn-footer">
          <div className="grn-footer-totals">
            <span>Lines total</span>
            <strong>{formatMoney(linesTotal)}</strong>
            <span>Invoice</span>
            <strong>
              {inward.invoiceAmount ? formatMoney(Number(inward.invoiceAmount) || 0) : "—"}
            </strong>
          </div>
          <div className="grn-footer-actions">
            <Link className="btn admin-ghost-btn" href="/admin/inventory">
              Cancel
            </Link>
            <button type="submit" className="btn" disabled={saving || loading}>
              {saving ? "Posting…" : "Post inward"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

export default function AdminGrnPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <GrnPageInner />
    </Suspense>
  );
}
