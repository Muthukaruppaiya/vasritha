"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ClipboardCheck,
  Eye,
  History,
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
} from "../../../../../components/admin/admin-ui";
import { AdminPagination, DEFAULT_PAGE_SIZE } from "../../../../../components/admin/admin-pagination";
import {
  adminFetch,
  formatDate,
  formatMoney,
  getAdminUser
} from "../../../../../lib/admin-api";
import { printGrnDocument, type GrnPrintDetail } from "../../../../../lib/print-grn";
import { useAdminQuery } from "../../../../../hooks/use-admin-query";

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
  approved_at?: string | null;
};

export default function AdminGrnHistoryPage() {
  const sessionShopId = getAdminUser()?.shopId || null;

  const [statusFilter, setStatusFilter] = useState<
    "all" | "approved" | "pending_approval" | "cancelled"
  >("all");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(0);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printError, setPrintError] = useState("");
  const [detail, setDetail] = useState<GrnPrintDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const { data: suppliers } = useAdminQuery<Supplier[]>("/api/admin/suppliers?active=1");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, supplierFilter, debouncedQ]);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", statusFilter);
    params.set("limit", "200");
    if (supplierFilter) params.set("supplierId", supplierFilter);
    if (sessionShopId) params.set("shopId", sessionShopId);
    if (debouncedQ) params.set("q", debouncedQ);
    return `/api/admin/inventory/grn?${params.toString()}`;
  }, [statusFilter, supplierFilter, sessionShopId, debouncedQ]);

  const {
    data: listedGrns,
    loading: listLoading,
    error: listError
  } = useAdminQuery<ListedGrn[]>(listUrl);

  const pagedGrns = useMemo(() => {
    const start = page * DEFAULT_PAGE_SIZE;
    return (listedGrns || []).slice(start, start + DEFAULT_PAGE_SIZE);
  }, [listedGrns, page]);

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

  return (
    <>
      <AdminPageHeader
        eyebrow="Inventory"
        title="GRN history"
        description="All goods receipts — search, filter, view details, and reprint."
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
            <Link className="admin-icon-tip" href="/admin/inventory/approvals">
              <ClipboardCheck size={16} strokeWidth={2} />
              <span>GRN approvals</span>
            </Link>
            <Link className="admin-icon-tip" href="/admin/suppliers">
              <Truck size={16} strokeWidth={2} />
              <span>Supplier Master</span>
            </Link>
          </>
        }
      />

      {printError ? <AdminAlert>{printError}</AdminAlert> : null}
      {detailError ? <AdminAlert>{detailError}</AdminAlert> : null}

      <AdminPanel
        title="Receipts"
        actions={
          <span className="muted">
            <History size={14} style={{ display: "inline", verticalAlign: "-2px" }} />{" "}
            {(listedGrns || []).length} shown
          </span>
        }
      >
        <div className="grn-toolbar grn-approve-filters">
          <label style={{ flex: "1 1 220px" }}>
            <span>Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="GRN number, bill, supplier…"
              autoComplete="off"
            />
          </label>
          <label>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "all" | "approved" | "pending_approval" | "cancelled"
                )
              }
            >
              <option value="all">All statuses</option>
              <option value="approved">Approved</option>
              <option value="pending_approval">Pending approval</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label>
            <span>Supplier</span>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
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

        {listError ? <AdminAlert>{listError}</AdminAlert> : null}
        {listLoading ? <AdminLoading /> : null}

        {!listLoading && !(listedGrns || []).length ? (
          <AdminEmpty
            title="No GRNs found"
            body="Create a goods receipt on the entry page. Approved and pending receipts appear here."
            action={
              <Link className="btn admin-ghost-btn" href="/admin/inventory/grn">
                Open GRN entry
              </Link>
            }
          />
        ) : null}

        {!listLoading && (listedGrns || []).length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>GRN</th>
                  <th>Supplier</th>
                  <th>Bill</th>
                  <th>Invoice date</th>
                  <th>Doc</th>
                  <th>Lines</th>
                  <th>Invoice</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Approved</th>
                  <th className="admin-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedGrns.map((row) => (
                  <tr key={row.id}>
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
                    <td>{row.approved_at ? formatDate(row.approved_at) : "—"}</td>
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
                ))}
              </tbody>
            </table>
            <AdminPagination
              page={page}
              total={(listedGrns || []).length}
              onPageChange={setPage}
              noun="GRNs"
            />
          </div>
        ) : null}
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
            aria-labelledby="grn-history-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-head">
              <div>
                <p className="eyebrow">GRN details</p>
                <h2 id="grn-history-detail-title">{detail.grn_number}</h2>
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
                      <th>Qty</th>
                      <th>Purchase ₹</th>
                      <th>Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((line, index) => {
                      const colours = (line.color_breakdown || [])
                        .filter((s) => s.color && s.quantity > 0)
                        .map((s) => `${s.color} × ${s.quantity}`)
                        .join(", ");
                      return (
                        <tr key={`${line.product_name}-${index}`}>
                          <td>
                            <strong>{line.product_name}</strong>
                            {line.variant_name ? (
                              <div className="muted admin-sub">{line.variant_name}</div>
                            ) : null}
                            {colours ? <div className="muted admin-sub">{colours}</div> : null}
                          </td>
                          <td>{line.quantity}</td>
                          <td>{formatMoney(line.purchase_price)}</td>
                          <td>{formatMoney(line.line_total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-icon-tip"
                  onClick={closeDetails}
                  data-tooltip="Close"
                  aria-label="Close"
                >
                  <X size={16} strokeWidth={2} />
                  <span>Close</span>
                </button>
                <button
                  type="button"
                  className="admin-icon-tip"
                  onClick={() => void printGrn(detail.id)}
                  disabled={printingId === detail.id}
                  data-tooltip={printingId === detail.id ? "Printing…" : "Print"}
                  aria-label={printingId === detail.id ? "Printing…" : "Print GRN"}
                >
                  <Printer size={16} strokeWidth={2} />
                  <span>{printingId === detail.id ? "Printing…" : "Print"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
