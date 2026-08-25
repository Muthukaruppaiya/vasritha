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
import { AdminFormModal } from "../../../components/admin/admin-form-modal";
import { adminFetch, formatDate, formatMoney } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  headline: string | null;
  discount_type: string;
  discount_value: string;
  min_order_amount: string;
  max_discount_amount: string | null;
  usage_limit: number | null;
  status: string;
  kind: string;
  show_on_open: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

const blankForm = () => ({
  code: "",
  headline: "",
  description: "",
  discount_type: "percentage",
  discount_value: "",
  min_order_amount: "0",
  max_discount_amount: "",
  usage_limit: "",
  status: "active",
  kind: "gift_voucher",
  show_on_open: true
});

export default function AdminCouponsPage() {
  const { data, error, loading, reload } = useAdminQuery<Coupon[]>("/api/admin/coupons");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(blankForm);

  const openCreate = () => {
    setForm(blankForm());
    setFormError("");
    setModalOpen(true);
  };

  const toggleOpening = async (coupon: Coupon) => {
    await adminFetch(`/api/admin/coupons/${coupon.id}`, {
      method: "PATCH",
      json: { show_on_open: !coupon.show_on_open }
    });
    await reload();
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const result = await adminFetch("/api/admin/coupons", {
      method: "POST",
      json: {
        code: form.code,
        headline: form.headline || null,
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order_amount: Number(form.min_order_amount || 0),
        max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        status: form.status,
        kind: form.kind,
        show_on_open: form.show_on_open
      }
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setModalOpen(false);
    setForm(blankForm());
    await reload();
  };

  return (
    <>
      <AdminPageHeader
        eyebrow=""
        title="Coupons & gift vouchers"
        actions={
          <button type="button" className="btn" onClick={openCreate}>
            + New gift voucher
          </button>
        }
      />

      <AdminPanel title="Promotions">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !(data || []).length && <AdminEmpty title="No coupons yet" />}
        {(data || []).length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Discount</th>
                  <th>Opening notice</th>
                  <th>Min order</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((coupon) => (
                  <tr key={coupon.id}>
                    <td>
                      <b>{coupon.code}</b>
                      <div className="muted admin-sub">{coupon.headline || coupon.description || "—"}</div>
                    </td>
                    <td>{coupon.kind === "gift_voucher" ? "Gift voucher" : "Coupon"}</td>
                    <td>
                      {coupon.discount_type === "percentage"
                        ? `${coupon.discount_value}%`
                        : formatMoney(coupon.discount_value)}
                    </td>
                    <td>{coupon.show_on_open ? "Yes" : "No"}</td>
                    <td>{formatMoney(coupon.min_order_amount)}</td>
                    <td>
                      <AdminBadge tone={statusTone(coupon.status)}>{coupon.status}</AdminBadge>
                    </td>
                    <td>{formatDate(coupon.created_at)}</td>
                    <td>
                      <button type="button" className="btn ghost" onClick={() => toggleOpening(coupon)}>
                        {coupon.show_on_open ? "Hide opening" : "Show on open"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      <AdminFormModal
        open={modalOpen}
        title="Add gift voucher / coupon"
        eyebrow="Promotions"
        submitLabel="Create"
        savingLabel="Creating…"
        saving={saving}
        error={formError}
        onClose={() => setModalOpen(false)}
        onSubmit={onCreate}
      >
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
            value={form.kind}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                kind: e.target.value,
                show_on_open: e.target.value === "gift_voucher" ? true : f.show_on_open
              }))
            }
          >
            <option value="gift_voucher">Gift voucher (opening notice)</option>
            <option value="coupon">Checkout coupon only</option>
          </select>
        </label>
        <label>
          <span>Show when website opens</span>
          <select
            value={form.show_on_open ? "yes" : "no"}
            onChange={(e) => setForm((f) => ({ ...f, show_on_open: e.target.value === "yes" }))}
          >
            <option value="yes">Yes — popup on visit</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="admin-span-2">
          <span>Headline</span>
          <input
            value={form.headline}
            placeholder="Festive gift voucher"
            onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
          />
        </label>
        <label>
          <span>Discount type</span>
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
        <label>
          <span>Status</span>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label className="admin-span-2">
          <span>Description</span>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>
      </AdminFormModal>
    </>
  );
}
