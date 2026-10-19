"use client";

import { useMemo, useState } from "react";
import { Check, PackageCheck, RefreshCw, X } from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  statusTone
} from "../../../components/admin/admin-ui";
import { adminFetch, formatDate } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";
import { AdminPagination, DEFAULT_PAGE_SIZE } from "../../../components/admin/admin-pagination";

type ReturnRow = {
  id: string;
  return_number: string;
  status: string;
  reason: string | null;
  request_type?: string | null;
  refund_amount: string | null;
  created_at: string;
  orders: { order_number: string; total_amount: string } | null;
  return_items: unknown[];
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

  const rows = data || [];

  const paged = useMemo(() => {
    const start = page * DEFAULT_PAGE_SIZE;
    return rows.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [rows, page]);

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

  return (
    <>
      <AdminPageHeader
        eyebrow="Orders"
        title="Exchanges"
        description="NO REFUND boutique policy — approve, receive and complete exchange requests only. Cash refunds are blocked by the server."
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
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      <div className="admin-row-actions" role="group" aria-label="Exchange actions">
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
              noun="exchange requests"
            />
          </div>
        )}
      </AdminPanel>
    </>
  );
}
