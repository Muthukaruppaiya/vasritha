"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Printer,
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
  const [bulkSummary, setBulkSummary] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pending_approval" | "all">("pending_approval");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printError, setPrintError] = useState("");

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
      json: { ids: Array.from(selected), shopId: sessionShopId || undefined }
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
    await reloadList();
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
        <AdminAlert tone="ok">GRN submitted for approval. Print from the row actions when ready.</AdminAlert>
      )}
      {bulkSummary && (
        <AdminAlert tone={bulkSummary.toLowerCase().includes("failed") ? "error" : "ok"}>
          {bulkSummary}
        </AdminAlert>
      )}
      {printError && <AdminAlert>{printError}</AdminAlert>}

      <AdminPanel
        title="Pending & history"
        actions={
          eligiblePending.length > 0 ? (
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
            body="Create a GRN on the entry page. Pending receipts show here for approval."
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
                  <th className="admin-actions-col">Print</th>
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
                        <button
                          type="button"
                          className="admin-icon-tip"
                          disabled={printingId === row.id}
                          onClick={() => void printGrn(row.id)}
                          aria-label={`Print ${row.grn_number}`}
                          title="Print GRN"
                        >
                          <Printer size={15} strokeWidth={2} />
                          <span>{printingId === row.id ? "…" : "Print"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
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
