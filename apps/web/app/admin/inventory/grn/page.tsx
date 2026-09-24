"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  PackagePlus,
  Plus,
  Printer,
  Trash2,
  Truck
} from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  statusTone
} from "../../../../components/admin/admin-ui";
import {
  adminFetch,
  formatDate,
  formatMoney,
  getAdminUser
} from "../../../../lib/admin-api";
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

type PendingGrn = {
  id: string;
  grn_number: string;
  status: string;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_code: string | null;
  bill_no: string | null;
  invoice_amount: string | number | null;
  lines_total: string | number;
  line_count: number;
  created_at: string;
};

type BulkApproveResult = {
  requested: number;
  succeededCount: number;
  failedCount: number;
  succeeded: Array<{ id: string; grn_number: string; units: number; movements: number }>;
  failed: Array<{ id: string; grn_number?: string; error: string }>;
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

  const canApprove = Boolean(
    getAdminUser()?.permissions?.includes("stock:approve") ||
      ["super_admin", "business_owner", "manager"].includes(getAdminUser()?.primaryRole || "")
  );

  const [inward, setInward] = useState<GrnDraft>(() => blankGrnDraft());
  const [skuFilter, setSkuFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");
  const [draftBanner, setDraftBanner] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"pending_approval" | "all">("pending_approval");
  const [supplierFilter, setSupplierFilter] = useState("");

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", statusFilter);
    if (supplierFilter) params.set("supplierId", supplierFilter);
    return `/api/admin/inventory/grn?${params.toString()}`;
  }, [statusFilter, supplierFilter]);

  const {
    data: listedGrns,
    loading: listLoading,
    error: listError,
    reload: reloadList
  } = useAdminQuery<PendingGrn[]>(listUrl);

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

  const eligiblePending = useMemo(
    () => (listedGrns || []).filter((row) => row.status === "pending_approval"),
    [listedGrns]
  );

  const allVisibleSelected =
    eligiblePending.length > 0 && eligiblePending.every((row) => selected.has(row.id));

  const persistDraft = (next: GrnDraft) => {
    setInward(next);
    saveGrnDraft(next);
  };

  const updateLine = (index: number, patch: Partial<GrnDraftLine>) => {
    const lines = [...inward.lines];
    lines[index] = { ...lines[index], ...patch };
    persistDraft({ ...inward, lines });
  };

  const toggleSelect = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((current) => {
      if (allVisibleSelected) {
        const next = new Set(current);
        for (const row of eligiblePending) next.delete(row.id);
        return next;
      }
      const next = new Set(current);
      for (const row of eligiblePending) next.add(row.id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const bulkApprove = async () => {
    if (!selected.size || !canApprove) return;
    const count = selected.size;
    const okConfirm = window.confirm(
      `Approve ${count} GRN${count === 1 ? "" : "s"}?\n\nStock will increase once for each approved GRN.`
    );
    if (!okConfirm) return;

    setBulkBusy(true);
    setBulkSummary("");
    const result = await adminFetch<BulkApproveResult>("/api/admin/inventory/grn/approve", {
      method: "POST",
      json: { ids: Array.from(selected) }
    });
    setBulkBusy(false);

    if (result.error) {
      setBulkSummary(result.error);
      return;
    }

    const data = result.data;
    const parts = [
      `Approved ${data?.succeededCount || 0} of ${data?.requested || count}.`,
      data?.failedCount
        ? `Failed: ${(data.failed || [])
            .map((f) => `${f.grn_number || f.id.slice(0, 8)} — ${f.error}`)
            .slice(0, 5)
            .join("; ")}`
        : null
    ].filter(Boolean);
    setBulkSummary(parts.join(" "));
    clearSelection();
    await Promise.all([reloadList(), reload()]);
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

  const submitGrn = async (approveNow = false) => {
    setSaving(true);
    setFormError("");
    setFormOk("");

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
        approveNow: approveNow || undefined,
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
    setInward(blankGrnDraft());
    await Promise.all([reloadList(), reload()]);

    if (result.data?.pending) {
      setFormOk(
        result.data.approveError
          ? `GRN ${result.data.grn_number} saved as pending. Approve failed: ${result.data.approveError}`
          : `GRN ${result.data.grn_number} submitted for approval. Stock updates after manager approval.`
      );
      setStatusFilter("pending_approval");
      return;
    }

    setFormOk(
      `GRN ${result.data?.grn_number || ""} approved. ${result.data?.units || 0} units added to stock.`
    );
    router.push("/admin/barcodes");
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitGrn(false);
  };

  if (!hydrated) return <AdminLoading />;

  return (
    <>
      <AdminPageHeader
        eyebrow="Step 2 · Inventory"
        title="Receive stock (GRN)"
        description="Submit supplier inward for approval. Stock increases only after a manager approves the GRN."
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
      {formOk && <AdminAlert tone="ok">{formOk}</AdminAlert>}
      {draftBanner && <AdminAlert tone="ok">{draftBanner}</AdminAlert>}
      {bulkSummary && (
        <AdminAlert tone={bulkSummary.toLowerCase().includes("failed") ? "error" : "ok"}>
          {bulkSummary}
        </AdminAlert>
      )}

      <AdminPanel
        title="GRN approvals"
        actions={
          eligiblePending.length > 0 ? (
            <span className="muted">{eligiblePending.length} pending</span>
          ) : null
        }
      >
        <div className="grn-toolbar grn-approve-filters">
          <label>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as "pending_approval" | "all");
                clearSelection();
              }}
            >
              <option value="pending_approval">Pending approval</option>
              <option value="all">All statuses</option>
            </select>
          </label>
          <label>
            <span>Supplier</span>
            <select
              value={supplierFilter}
              onChange={(e) => {
                setSupplierFilter(e.target.value);
                clearSelection();
              }}
            >
              <option value="">All suppliers</option>
              {(suppliers || []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {row.code}
                </option>
              ))}
            </select>
          </label>
        </div>

        {listError && <AdminAlert>{listError}</AdminAlert>}
        {listLoading && <AdminLoading />}

        {canApprove && selected.size > 0 ? (
          <div className="admin-bulk-bar">
            <span>
              <b>{selected.size}</b> selected
            </span>
            <div className="admin-bulk-actions">
              <button type="button" disabled={bulkBusy} onClick={() => void bulkApprove()}>
                <CheckCircle2 size={14} />
                {bulkBusy ? "Approving…" : "Bulk approve"}
              </button>
              <button type="button" className="admin-bulk-clear" disabled={bulkBusy} onClick={clearSelection}>
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {!listLoading && !(listedGrns || []).length ? (
          <AdminEmpty
            title="No GRNs in this view"
            body="Submit a GRN below. Pending records appear here for manager approval."
          />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {canApprove ? (
                    <th className="admin-check-col">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        disabled={!eligiblePending.length}
                        aria-label="Select all pending GRNs"
                      />
                    </th>
                  ) : null}
                  <th>GRN</th>
                  <th>Supplier</th>
                  <th>Bill</th>
                  <th>Lines</th>
                  <th>Invoice</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {(listedGrns || []).map((row) => {
                  const isPending = row.status === "pending_approval";
                  return (
                    <tr key={row.id} className={selected.has(row.id) ? "is-selected" : ""}>
                      {canApprove ? (
                        <td className="admin-check-col">
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            disabled={!isPending}
                            onChange={() => toggleSelect(row.id)}
                            aria-label={`Select ${row.grn_number}`}
                          />
                        </td>
                      ) : null}
                      <td>
                        <strong>{row.grn_number}</strong>
                      </td>
                      <td>
                        {row.supplier_name || "—"}
                        {row.supplier_code ? (
                          <span className="muted"> · {row.supplier_code}</span>
                        ) : null}
                      </td>
                      <td>{row.bill_no || "—"}</td>
                      <td>{row.line_count}</td>
                      <td>{formatMoney(row.invoice_amount)}</td>
                      <td>
                        <AdminBadge tone={statusTone(row.status)}>
                          {row.status.replace(/_/g, " ")}
                        </AdminBadge>
                      </td>
                      <td>{formatDate(row.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

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
