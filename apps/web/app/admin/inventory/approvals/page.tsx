"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Printer,
  Truck,
  X
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
import { printGrnDocument, type GrnPrintDetail } from "../../../../lib/print-grn";
import { useAdminQuery } from "../../../../hooks/use-admin-query";

type Supplier = {
  id: string;
  code: string;
  name: string;
};

type ListedGrn = {
  id: string;
  grn_number: string;
  status: string;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_code: string | null;
  bill_no: string | null;
  invoice_amount: string | number | null;
  invoice_date?: string | null;
  document_path?: string | null;
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

function AdminGrnApprovalsInner() {
  const searchParams = useSearchParams();
  const justSubmitted = searchParams.get("submitted") === "1";
  const sessionShopId = getAdminUser()?.shopId || null;
  const canApprove = Boolean(
    getAdminUser()?.permissions?.includes("stock:approve") ||
      ["super_admin", "business_owner", "manager"].includes(getAdminUser()?.primaryRole || "")
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [bulkSummary, setBulkSummary] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "pending_approval" | "approved" | "cancelled" | "all"
  >("pending_approval");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printError, setPrintError] = useState("");
  const [detail, setDetail] = useState<GrnPrintDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const { data: suppliers } = useAdminQuery<Supplier[]>("/api/admin/suppliers?active=1");

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", statusFilter);
    if (supplierFilter) params.set("supplierId", supplierFilter);
    if (sessionShopId) params.set("shopId", sessionShopId);
    return `/api/admin/inventory/grn?${params.toString()}`;
  }, [statusFilter, supplierFilter, sessionShopId]);

  const {
    data: listedGrns,
    loading: listLoading,
    error: listError,
    reload: reloadList
  } = useAdminQuery<ListedGrn[]>(listUrl);

  const eligiblePending = useMemo(
    () => (listedGrns || []).filter((row) => row.status === "pending_approval"),
    [listedGrns]
  );

  const approvedCount = useMemo(
    () => (listedGrns || []).filter((row) => row.status === "approved").length,
    [listedGrns]
  );

  const allVisibleSelected =
    eligiblePending.length > 0 && eligiblePending.every((row) => selected.has(row.id));

  const clearSelection = () => setSelected(new Set());

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

  const openDetails = async (id: string) => {
    setDetailLoading(true);
    setDetailError("");
    setDetail(null);
    const result = await adminFetch<GrnPrintDetail>(`/api/admin/inventory/grn/${id}`);
    setDetailLoading(false);
    if (result.error || !result.data) {
      setDetailError(result.error || "Could not load GRN details");
      return;
    }
    setDetail(result.data);
  };

  const closeDetails = () => {
    setDetail(null);
    setDetailError("");
  };

  const printGrn = async (id: string) => {
    setPrintingId(id);
    setPrintError("");
    const result = await adminFetch<GrnPrintDetail>(`/api/admin/inventory/grn/${id}`);
    setPrintingId(null);
    if (result.error || !result.data) {
      setPrintError(result.error || "Could not load GRN for print");
      return;
    }
    try {
      printGrnDocument(result.data);
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : "Print failed");
    }
  };

  const approveIds = async (ids: string[], label: string) => {
    if (!ids.length || !canApprove) return false;
    const okConfirm = window.confirm(
      `${label}\n\nStock will increase once for each approved GRN.`
    );
    if (!okConfirm) return false;

    setBulkBusy(true);
    setBulkSummary("");
    const result = await adminFetch<BulkApproveResult>("/api/admin/inventory/grn/approve", {
      method: "POST",
      json: { ids, shopId: sessionShopId || undefined }
    });
    setBulkBusy(false);
    setApprovingId(null);

    if (result.error) {
      setBulkSummary(result.error);
      return false;
    }

    const data = result.data;
    const parts = [
      `Approved ${data?.succeededCount || 0} of ${data?.requested || ids.length}.`,
      data?.failedCount
        ? `Failed: ${(data.failed || [])
            .map((f) => `${f.grn_number || f.id.slice(0, 8)} — ${f.error}`)
            .slice(0, 5)
            .join("; ")}`
        : null
    ].filter(Boolean);
    setBulkSummary(parts.join(" "));
    clearSelection();
    if (detail && ids.includes(detail.id)) closeDetails();
    await reloadList();
    return true;
  };

  const bulkApprove = async () => {
    if (!selected.size) return;
    const count = selected.size;
    await approveIds(
      Array.from(selected),
      `Approve ${count} GRN${count === 1 ? "" : "s"}?`
    );
  };

  const approveOne = async (row: ListedGrn) => {
    if (!canApprove || row.status !== "pending_approval") return;
    setApprovingId(row.id);
    const ok = await approveIds([row.id], `Approve ${row.grn_number}?`);
    if (!ok) setApprovingId(null);
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Step 2 · Inventory"
        title="GRN approvals"
        description="Review pending goods receipts. Stock increases only after a manager approves."
        actions={
          <>
            <Link className="admin-icon-tip" href="/admin/inventory">
              <ArrowLeft size={16} strokeWidth={2} />
              <span>Back to inventory</span>
            </Link>
            <Link className="admin-icon-tip" href="/admin/inventory/grn">
              <ArrowDownToLine size={16} strokeWidth={2} />
              <span>GRN entry</span>
            </Link>
            <Link className="admin-icon-tip" href="/admin/barcodes">
              <Printer size={16} strokeWidth={2} />
              <span>Print barcodes</span>
            </Link>
            <Link className="admin-icon-tip" href="/admin/suppliers">
              <Truck size={16} strokeWidth={2} />
              <span>Supplier Master</span>
            </Link>
          </>
        }
      />

      {justSubmitted && (
        <AdminAlert tone="ok">
          GRN submitted for approval. Open Details or Approve from the row actions when ready.
        </AdminAlert>
      )}
      {bulkSummary && (
        <AdminAlert tone={bulkSummary.toLowerCase().includes("failed") ? "error" : "ok"}>
          {bulkSummary}
        </AdminAlert>
      )}
      {printError && <AdminAlert>{printError}</AdminAlert>}
      {detailError && <AdminAlert>{detailError}</AdminAlert>}

      <AdminPanel
        title="Pending & history"
        actions={
          statusFilter === "approved" ? (
            <span className="muted">{approvedCount} approved</span>
          ) : eligiblePending.length > 0 ? (
            <span className="muted">{eligiblePending.length} pending</span>
          ) : (
            <span className="muted">
              <ClipboardCheck size={14} style={{ display: "inline", verticalAlign: "-2px" }} /> Ready
            </span>
          )
        }
      >
        <div className="grn-toolbar grn-approve-filters">
          <label>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(
                  e.target.value as "pending_approval" | "approved" | "cancelled" | "all"
                );
                clearSelection();
              }}
            >
              <option value="pending_approval">Pending approval</option>
              <option value="approved">Approved GRNs</option>
              <option value="cancelled">Cancelled</option>
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
              <button
                type="button"
                className="admin-bulk-clear"
                disabled={bulkBusy}
                onClick={clearSelection}
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {!canApprove ? (
          <AdminAlert>
            You can view GRNs here. Only managers can approve and release stock.
          </AdminAlert>
        ) : null}

        {!listLoading && !(listedGrns || []).length ? (
          <AdminEmpty
            title="No GRNs in this view"
            body={
              statusFilter === "approved"
                ? "No approved GRNs yet. Approve a pending receipt to see it here."
                : "Create a GRN on the entry page. Pending receipts show here for approval."
            }
            action={
              <Link className="btn admin-ghost-btn" href="/admin/inventory/grn">
                Open GRN entry
              </Link>
            }
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
                  <th>Invoice date</th>
                  <th>Doc</th>
                  <th>Lines</th>
                  <th>Invoice</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="admin-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(listedGrns || []).map((row) => {
                  const isPending = row.status === "pending_approval";
                  const rowBusy = approvingId === row.id || printingId === row.id || bulkBusy;
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
                      <td>{row.invoice_date ? formatDate(row.invoice_date) : "—"}</td>
                      <td>
                        {row.document_path ? (
                          <a href={row.document_path} target="_blank" rel="noreferrer">
                            View
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{row.line_count}</td>
                      <td>{formatMoney(row.invoice_amount)}</td>
                      <td>
                        <AdminBadge tone={statusTone(row.status)}>
                          {row.status.replace(/_/g, " ")}
                        </AdminBadge>
                      </td>
                      <td>{formatDate(row.created_at)}</td>
                      <td className="admin-actions-col">
                        <div className="admin-row-actions">
                          <button
                            type="button"
                            className="admin-icon-tip"
                            disabled={detailLoading}
                            onClick={() => void openDetails(row.id)}
                            aria-label={`Details ${row.grn_number}`}
                            data-tooltip="Details"
                          >
                            <Eye size={15} strokeWidth={2} />
                            <span>Details</span>
                          </button>
                          {canApprove && isPending ? (
                            <button
                              type="button"
                              className="admin-icon-tip"
                              disabled={rowBusy}
                              onClick={() => void approveOne(row)}
                              aria-label={`Approve ${row.grn_number}`}
                              data-tooltip="Approve"
                            >
                              <CheckCircle2 size={15} strokeWidth={2} />
                              <span>{approvingId === row.id ? "…" : "Approve"}</span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="admin-icon-tip"
                            disabled={printingId === row.id}
                            onClick={() => void printGrn(row.id)}
                            aria-label={`Print ${row.grn_number}`}
                            data-tooltip="Print"
                          >
                            <Printer size={15} strokeWidth={2} />
                            <span>{printingId === row.id ? "…" : "Print"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      {detailLoading ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div className="admin-modal" role="dialog" aria-modal="true">
            <div className="admin-modal-body">
              <AdminLoading />
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={closeDetails}>
          <div
            className="admin-modal admin-modal--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="grn-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-head">
              <div>
                <p className="eyebrow">GRN details</p>
                <h2 id="grn-detail-title">{detail.grn_number}</h2>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                aria-label="Close"
                onClick={closeDetails}
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="grn-detail-meta">
                <div>
                  <span className="muted">Status</span>
                  <div>
                    <AdminBadge tone={statusTone(detail.status)}>
                      {detail.status.replace(/_/g, " ")}
                    </AdminBadge>
                  </div>
                </div>
                <div>
                  <span className="muted">Supplier</span>
                  <strong>
                    {detail.supplier.name || "—"}
                    {detail.supplier.code ? ` · ${detail.supplier.code}` : ""}
                  </strong>
                </div>
                <div>
                  <span className="muted">Bill no</span>
                  <strong>{detail.bill_no || "—"}</strong>
                </div>
                <div>
                  <span className="muted">Invoice date</span>
                  <strong>{detail.invoice_date ? formatDate(detail.invoice_date) : "—"}</strong>
                </div>
                <div>
                  <span className="muted">Invoice amount</span>
                  <strong>{formatMoney(detail.invoice_amount)}</strong>
                </div>
                <div>
                  <span className="muted">Lines total</span>
                  <strong>{formatMoney(detail.lines_total)}</strong>
                </div>
                <div>
                  <span className="muted">Created</span>
                  <strong>{formatDate(detail.created_at)}</strong>
                </div>
                <div>
                  <span className="muted">Approved</span>
                  <strong>{detail.approved_at ? formatDate(detail.approved_at) : "—"}</strong>
                </div>
              </div>

              {detail.note ? (
                <p className="grn-detail-note">
                  <span className="muted">Note: </span>
                  {detail.note}
                </p>
              ) : null}

              {detail.document_path ? (
                <p>
                  <a href={detail.document_path} target="_blank" rel="noreferrer">
                    Open attached document
                  </a>
                </p>
              ) : null}

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Qty</th>
                      <th>Purchase ₹</th>
                      <th>Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((line, index) => (
                      <tr key={`${line.sku || line.product_name}-${index}`}>
                        <td>
                          <strong>{line.product_name}</strong>
                          {line.variant_name ? (
                            <div className="muted admin-sub">{line.variant_name}</div>
                          ) : null}
                        </td>
                        <td>{line.sku || "—"}</td>
                        <td>{line.quantity}</td>
                        <td>{formatMoney(line.purchase_price)}</td>
                        <td>{formatMoney(line.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="admin-ghost-btn" onClick={closeDetails}>
                  Close
                </button>
                <button
                  type="button"
                  className="admin-ghost-btn"
                  onClick={() => void printGrn(detail.id)}
                  disabled={printingId === detail.id}
                >
                  <Printer size={14} />
                  {printingId === detail.id ? "Printing…" : "Print"}
                </button>
                {canApprove && detail.status === "pending_approval" ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={bulkBusy || approvingId === detail.id}
                    onClick={() =>
                      void approveIds([detail.id], `Approve ${detail.grn_number}?`)
                    }
                  >
                    <CheckCircle2 size={14} />
                    {approvingId === detail.id || bulkBusy ? "Approving…" : "Approve GRN"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function AdminGrnApprovalsPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminGrnApprovalsInner />
    </Suspense>
  );
}
