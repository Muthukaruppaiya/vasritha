"use client";

import { useMemo, useState } from "react";
import { Check, EyeOff, Star } from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../components/admin/admin-ui";
import { adminFetch, formatDate } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type ReviewRow = {
  id: string;
  product_id: string | null;
  customer_name: string;
  reviewer_email: string | null;
  rating: number;
  title: string | null;
  body: string;
  image_path: string | null;
  is_featured: boolean;
  is_approved: boolean;
  created_at: string;
  product_name: string | null;
  product_slug: string | null;
};

type Filter = "pending" | "approved" | "all";

export default function AdminReviewsPage() {
  const [filter, setFilter] = useState<Filter>("pending");
  const queryPath = useMemo(() => `/api/reviews?admin=1&status=${filter}`, [filter]);
  const { data, error, loading, reload } = useAdminQuery<ReviewRow[]>(queryPath);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const moderate = async (reviewId: string, patch: { is_approved?: boolean; is_featured?: boolean }) => {
    setBusyId(reviewId);
    setActionError("");
    const result = await adminFetch("/api/reviews", {
      method: "PATCH",
      json: { reviewId, ...patch }
    });
    setBusyId(null);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    await reload();
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Reviews"
        description="Approve, hide, and feature customer product reviews before they appear on the storefront."
      />

      <div className="admin-tabs">
        {(["pending", "approved", "all"] as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            className={filter === key ? "is-active" : ""}
            onClick={() => setFilter(key)}
          >
            {key === "pending" ? "Pending approval" : key === "approved" ? "Published" : "All"}
          </button>
        ))}
      </div>

      <AdminPanel title="Product reviews">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {actionError && <AdminAlert>{actionError}</AdminAlert>}
        {!loading && !(data || []).length && (
          <AdminEmpty
            title={filter === "pending" ? "No pending reviews" : "No reviews yet"}
            body="Customer reviews submitted from product pages will appear here."
          />
        )}
        {(data || []).length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Review</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>When</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.product_name || "—"}</b>
                      {row.product_slug ? (
                        <div className="muted admin-sub">/{row.product_slug}</div>
                      ) : null}
                    </td>
                    <td>
                      <div className="admin-review-cell">
                        {row.image_path ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.image_path} alt="" className="admin-review-thumb" />
                        ) : null}
                        <div>
                          <div>
                            {"★".repeat(row.rating)}
                            <span className="muted">{"★".repeat(5 - row.rating)}</span>
                          </div>
                          {row.title ? <b>{row.title}</b> : null}
                          <p className="muted admin-sub">{row.body}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <b>{row.customer_name}</b>
                      <div className="muted admin-sub">{row.reviewer_email || "—"}</div>
                    </td>
                    <td>
                      <AdminBadge tone={row.is_approved ? "success" : "warn"}>
                        {row.is_approved ? "published" : "pending"}
                      </AdminBadge>
                      {row.is_featured ? (
                        <div className="muted admin-sub">featured</div>
                      ) : null}
                    </td>
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      <div className="admin-row-actions" role="group" aria-label="Review actions">
                        {!row.is_approved ? (
                          <button
                            type="button"
                            className="admin-action-btn admin-action-btn--primary"
                            disabled={busyId === row.id}
                            onClick={() => void moderate(row.id, { is_approved: true })}
                            title="Approve and show on site"
                            aria-label={`Approve review by ${row.customer_name}`}
                          >
                            <Check size={14} strokeWidth={2} />
                            <span>Approve / show</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-action-btn"
                            disabled={busyId === row.id}
                            onClick={() => void moderate(row.id, { is_approved: false })}
                            title="Hide from site"
                            aria-label={`Hide review by ${row.customer_name}`}
                          >
                            <EyeOff size={14} strokeWidth={2} />
                            <span>Hide from site</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="admin-action-btn"
                          disabled={busyId === row.id}
                          onClick={() =>
                            void moderate(row.id, { is_featured: !row.is_featured })
                          }
                          title={row.is_featured ? "Remove featured" : "Feature review"}
                          aria-label={
                            row.is_featured
                              ? `Unfeature review by ${row.customer_name}`
                              : `Feature review by ${row.customer_name}`
                          }
                        >
                          <Star size={14} strokeWidth={2} />
                          <span>{row.is_featured ? "Unfeature" : "Feature"}</span>
                        </button>
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
