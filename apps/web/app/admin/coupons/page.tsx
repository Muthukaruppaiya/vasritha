"use client";

import { FormEvent, useState } from "react";
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

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: string;
  min_order_amount: string;
  max_discount_amount: string | null;
  usage_limit: number | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

export default function AdminCouponsPage() {
  const { data, error, loading, reload } = useAdminQuery<Coupon[]>("/api/admin/coupons");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    code: "",
    description: "",
    discount_type: "percentage",
    discount_value: "",
    min_order_amount: "0",
    max_discount_amount: "",
    usage_limit: "",
    status: "active"
  });

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const result = await adminFetch("/api/admin/coupons", {
      method: "POST",
      json: {
        code: form.code,
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order_amount: Number(form.min_order_amount || 0),
        max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        status: form.status
      }
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setShowForm(false);
    setForm({
      code: "",
      description: "",
      discount_type: "percentage",
      discount_value: "",
      min_order_amount: "0",
      max_discount_amount: "",
      usage_limit: "",
      status: "active"
    });
    await reload();
  };

  return (
    <>
      <AdminPageHeader
        title="Coupons"
        description="Create promotional codes and discount rules."
        actions={
          <button type="button" className="btn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close form" : "+ New coupon"}
          </button>
        }
      />

      {showForm && (
        <AdminPanel title="Create coupon">
          <form className="admin-form-grid" onSubmit={onCreate}>
            <label>
              <span>Code</span>
              <input
                required
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
            </label>
            <label>
              <span>Type</span>
              <select
                value={form.discount_type}
                onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value }))}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>
            <label>
              <span>Value</span>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.discount_value}
                onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
              />
            </label>
            <label>
              <span>Min order</span>
              <input
                type="number"
                min="0"
                value={form.min_order_amount}
                onChange={(e) => setForm((f) => ({ ...f, min_order_amount: e.target.value }))}
              />
            </label>
            <label>
              <span>Max discount</span>
              <input
                type="number"
                min="0"
                value={form.max_discount_amount}
                onChange={(e) => setForm((f) => ({ ...f, max_discount_amount: e.target.value }))}
              />
            </label>
            <label>
              <span>Usage limit</span>
              <input
                type="number"
                min="0"
                value={form.usage_limit}
                onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))}
              />
            </label>
            <label className="admin-span-2">
              <span>Description</span>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            {formError && <AdminAlert>{formError}</AdminAlert>}
            <div className="admin-span-2">
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Create coupon"}
              </button>
            </div>
          </form>
        </AdminPanel>
      )}

      <AdminPanel title="Active promotions">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !(data || []).length && <AdminEmpty title="No coupons yet" />}
        {(data || []).length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Min order</th>
                  <th>Limit</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((coupon) => (
                  <tr key={coupon.id}>
                    <td>
                      <b>{coupon.code}</b>
                      <div className="muted admin-sub">{coupon.description || "—"}</div>
                    </td>
                    <td>
                      {coupon.discount_type === "percentage"
                        ? `${coupon.discount_value}%`
                        : formatMoney(coupon.discount_value)}
                    </td>
                    <td>{formatMoney(coupon.min_order_amount)}</td>
                    <td>{coupon.usage_limit ?? "∞"}</td>
                    <td>
                      <AdminBadge tone={statusTone(coupon.status)}>{coupon.status}</AdminBadge>
                    </td>
                    <td>{formatDate(coupon.created_at)}</td>
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
