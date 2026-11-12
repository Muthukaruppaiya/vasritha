"use client";

import { useMemo, useState } from "react";
import { Ban, Check, Eye, PackageCheck, RefreshCw, X } from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  statusTone
} from "../../../components/admin/admin-ui";
import { adminFetch, formatDate, formatMoney } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";
import { AdminPagination, useAdminPageSize } from "../../../components/admin/admin-pagination";

type ExchangeProduct = {
  id?: string;
  quantity: number;
  reason?: string | null;
  product_name: string | null;
  variant_name: string | null;
  sku: string | null;
  unit_price: string | null;
  line_total?: string | null;
};

type ReturnRow = {
  id: string;
  return_number: string;
  status: string;
  reason: string | null;
  admin_notes?: string | null;
  request_type?: string | null;
  qc_status?: string | null;
  refund_amount: string | null;
  created_at: string;
  orders: { order_number: string; total_amount: string } | null;
  return_items: ExchangeProduct[];
  replacement_order_number?: string | null;
  replacement_items?: ExchangeProduct[];
};

const NEXT: Record<string, string[]> = {
  requested: ["approved", "rejected"],
  approved: ["received", "rejected"],
  received: ["exchanged"],
  rejected: [],
  exchanged: [],
  refunded: []
};

const STATUS_ACTION: Record<
  string,
  { label: string; icon: typeof Check; primary?: boolean; danger?: boolean }
> = {
  approved: { label: "Approve exchange", icon: Check, primary: true },
  rejected: { label: "Reject", icon: X, danger: true },
  received: { label: "Mark received", icon: PackageCheck },
  exchanged: { label: "Mark exchanged", icon: RefreshCw, primary: true }
};

export default function AdminReturnsPage() {
  const { data, error, loading, reload } = useAdminQuery<ReturnRow[]>("/api/admin/returns");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useAdminPageSize();
  const [detail, setDetail] = useState<ReturnRow | null>(null);

  const rows = data || [];

  const paged = useMemo(() => {
    const start = page * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const update = async (returnId: string, status: string) => {
    const result = await adminFetch("/api/admin/returns", {
      method: "PATCH",
      json: { returnId, status }
    });
    if (result.error) {
      window.alert(result.error);
      return;
    }
    await reload();
  };

  const decideQc = async (row: ReturnRow, qc: "approve" | "damage") => {
    const ok = window.confirm(
      qc === "approve"
        ? `Approve ${row.return_number} for sale? It will show in POS.`
        : `Mark ${row.return_number} as damaged? It will not be sold.`
    );
    if (!ok) return;
    const result = await adminFetch("/api/admin/returns", {
      method: "PATCH",
      json: { returnId: row.id, qc }
    });
    if (result.error) {
      window.alert(result.error);
      return;
    }
    await reload();
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Orders"
        title="Exchanges"
        description="Exchange history. Returned pieces stay off the POS list until you approve them here. Disapprove marks the piece damaged."
      />

      <AdminPanel title="Exchange requests">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !rows.length && <AdminEmpty title="No exchange requests yet" />}
        {rows.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Order</th>
                  <th>Reason</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>QC</th>
                  <th>Requested</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.return_number}</b>
                      <div className="muted admin-sub">
                        {row.request_type === "exchange" || !row.request_type
                          ? "Exchange"
                          : row.request_type}
                      </div>
                    </td>
                    <td>{row.orders?.order_number || "—"}</td>
                    <td>{row.reason || "—"}</td>
                    <td>{row.return_items?.length ?? 0}</td>
                    <td>
                      <AdminBadge tone={statusTone(row.status)}>{row.status}</AdminBadge>
                    </td>
                    <td>
                      {row.qc_status ? (
                        <AdminBadge tone={statusTone(row.qc_status)}>
                          {row.qc_status === "pending"
                            ? "QC pending"
                            : row.qc_status === "approved"
                              ? "On sale"
                              : "Damaged"}
                        </AdminBadge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      <div className="admin-row-actions" role="group" aria-label="Exchange actions">
                        <button
                          type="button"
                          className="admin-icon-tip"
                          onClick={() => setDetail(row)}
                          data-tooltip="Product details"
                          aria-label={`Product details for ${row.return_number}`}
                        >
                          <Eye size={16} strokeWidth={2} />
                          <span>Details</span>
                        </button>
                        {row.qc_status === "pending" ? (
                          <>
                            <button
                              type="button"
                              className="admin-icon-tip admin-action-btn--primary"
                              onClick={() => void decideQc(row, "approve")}
                              data-tooltip="Approve for POS"
                              aria-label={`Approve ${row.return_number} for POS`}
                            >
                              <Check size={16} strokeWidth={2} />
                              <span>Approve for POS</span>
                            </button>
                            <button
                              type="button"
                              className="admin-icon-tip admin-action-btn--danger"
                              onClick={() => void decideQc(row, "damage")}
                              data-tooltip="Mark damaged"
                              aria-label={`Mark ${row.return_number} damaged`}
                            >
                              <Ban size={16} strokeWidth={2} />
                              <span>Mark damaged</span>
                            </button>
                          </>
                        ) : null}
                        {(NEXT[row.status] || []).map((status) => {
                          const action = STATUS_ACTION[status];
                          const Icon = action?.icon;
                          const label = action?.label || `Mark ${status}`;
                          const className = [
                            "admin-icon-tip",
                            action?.primary ? "admin-action-btn--primary" : "",
                            action?.danger ? "admin-action-btn--danger" : ""
                          ]
                            .filter(Boolean)
                            .join(" ");
                          return (
                            <button
                              key={status}
                              type="button"
                              className={className}
                              onClick={() => void update(row.id, status)}
                              data-tooltip={label}
                              aria-label={`${label} for ${row.return_number}`}
                            >
                              {Icon ? <Icon size={16} strokeWidth={2} /> : null}
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <AdminPagination
              page={page}
              total={rows.length}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              noun="exchange requests"
            />
          </div>
        )}
      </AdminPanel>

      {detail ? (
        <ExchangeDetailModal row={detail} onClose={() => setDetail(null)} />
      ) : null}
    </>
  );
}

function productLabel(line: ExchangeProduct) {
  const name = line.product_name || "Product";
  return line.variant_name ? `${name} · ${line.variant_name}` : name;
}

function lineAmount(line: ExchangeProduct) {
  if (line.line_total != null && line.line_total !== "") return Number(line.line_total);
  return Number(line.unit_price || 0) * Number(line.quantity || 0);
}

function ExchangeLines({ lines }: { lines: ExchangeProduct[] }) {
  if (!lines.length) {
    return <p className="muted">No product lines on this exchange.</p>;
  }
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>SKU</th>
          <th>Qty</th>
          <th>Price</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => (
          <tr key={line.id || `${line.sku || "line"}-${index}`}>
            <td>
              <b>{productLabel(line)}</b>
              {line.reason ? <div className="muted admin-sub">{line.reason}</div> : null}
            </td>
            <td>{line.sku || "—"}</td>
            <td>{line.quantity}</td>
            <td>{formatMoney(lineAmount(line))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExchangeDetailModal({ row, onClose }: { row: ReturnRow; onClose: () => void }) {
  const returned = row.return_items || [];
  const given = row.replacement_items || [];
  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-modal admin-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exchange-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-modal-head">
          <div>
            <p className="eyebrow">Exchange products</p>
            <h2 id="exchange-detail-title">{row.return_number}</h2>
          </div>
          <button type="button" className="admin-modal-close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="admin-modal-body">
          <div className="grn-detail-meta">
            <div>
              <span className="muted">Original bill</span>
              <strong>{row.orders?.order_number || "—"}</strong>
            </div>
            <div>
              <span className="muted">New bill</span>
              <strong>{row.replacement_order_number || "—"}</strong>
            </div>
            <div>
              <span className="muted">Status</span>
              <div>
                <AdminBadge tone={statusTone(row.status)}>{row.status}</AdminBadge>
              </div>
            </div>
          </div>
          <p className="eyebrow">Returned</p>
          <ExchangeLines lines={returned} />
          <p className="eyebrow">Given on new bill</p>
          <ExchangeLines lines={given} />
          {row.admin_notes ? <p className="muted">{row.admin_notes}</p> : null}
          <div className="admin-modal-actions">
            <button type="button" className="admin-ghost-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
