"use client";

import { Check, PackageCheck, RotateCcw, X } from "lucide-react";
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

type ReturnRow = {
  id: string;
  return_number: string;
  status: string;
  reason: string | null;
  refund_amount: string | null;
  created_at: string;
  orders: { order_number: string; total_amount: string } | null;
  return_items: unknown[];
};

const NEXT: Record<string, string[]> = {
  requested: ["approved", "rejected"],
  approved: ["received"],
  received: ["refunded"],
  rejected: [],
  refunded: []
};

const STATUS_ACTION: Record<
  string,
  { label: string; icon: typeof Check; primary?: boolean; danger?: boolean }
> = {
  approved: { label: "Mark approved", icon: Check, primary: true },
  rejected: { label: "Mark rejected", icon: X, danger: true },
  received: { label: "Mark received", icon: PackageCheck },
  refunded: { label: "Mark refunded", icon: RotateCcw, primary: true }
};

export default function AdminReturnsPage() {
  const { data, error, loading, reload } = useAdminQuery<ReturnRow[]>("/api/admin/returns");

  const update = async (returnId: string, status: string) => {
    const result = await adminFetch("/api/admin/returns", {
      method: "PATCH",
      json: { returnId, status }
    });
    if (!result.error) await reload();
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Orders"
        title="Returns"
        description="Approve, receive and refund customer returns."
      />

      <AdminPanel title="Return requests">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !(data || []).length && <AdminEmpty title="No returns yet" />}
        {(data || []).length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Return</th>
                  <th>Order</th>
                  <th>Reason</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.return_number}</b>
                      {row.refund_amount ? (
                        <div className="muted admin-sub">{formatMoney(row.refund_amount)}</div>
                      ) : null}
                    </td>
                    <td>{row.orders?.order_number || "—"}</td>
                    <td>{row.reason || "—"}</td>
                    <td>{row.return_items?.length ?? 0}</td>
                    <td>
                      <AdminBadge tone={statusTone(row.status)}>{row.status}</AdminBadge>
                    </td>
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      <div className="admin-row-actions" role="group" aria-label="Return actions">
                        {(NEXT[row.status] || []).map((status) => {
                          const action = STATUS_ACTION[status];
                          const Icon = action?.icon;
                          const className = [
                            "admin-action-btn",
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
                              title={action?.label || `Mark ${status}`}
                              aria-label={`${action?.label || `Mark ${status}`} for ${row.return_number}`}
                            >
                              {Icon ? <Icon size={14} strokeWidth={2} /> : null}
                              <span>{action?.label || `Mark ${status}`}</span>
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
    </>
  );
}
