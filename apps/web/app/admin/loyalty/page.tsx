"use client";

import { FormEvent, useState } from "react";
import { Plus } from "lucide-react";
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
import { adminFetch } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type LoyaltyRule = {
  id: string;
  code: string;
  name: string;
  rule_type: string;
  is_active: boolean;
  sort_order: number;
  channel: string;
  points_per_amount: string;
  amount_unit: string;
  min_lifetime_spend: string;
  min_order_count: number;
  near_gap: string;
  reward_type: string;
  reward_value: string;
  message_template: string | null;
  unlocked_message: string | null;
};

const blankForm = () => ({
  code: "",
  name: "",
  rule_type: "spend_milestone",
  is_active: true,
  sort_order: "0",
  channel: "all",
  points_per_amount: "1",
  amount_unit: "100",
  min_lifetime_spend: "5000",
  min_order_count: "3",
  near_gap: "2000",
  reward_type: "percent",
  reward_value: "10",
  message_template: "Spend ₹{remaining} more to unlock {reward_value}% off.",
  unlocked_message: "Unlocked: {reward_value}% loyalty offer."
});

export default function AdminLoyaltyPage() {
  const { data, error, loading, reload } = useAdminQuery<LoyaltyRule[]>(
    "/api/admin/loyalty/rules"
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LoyaltyRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(blankForm);

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (rule: LoyaltyRule) => {
    setEditing(rule);
    setForm({
      code: rule.code,
      name: rule.name,
      rule_type: rule.rule_type,
      is_active: rule.is_active,
      sort_order: String(rule.sort_order ?? 0),
      channel: rule.channel || "all",
      points_per_amount: String(rule.points_per_amount ?? 1),
      amount_unit: String(rule.amount_unit ?? 100),
      min_lifetime_spend: String(rule.min_lifetime_spend ?? 0),
      min_order_count: String(rule.min_order_count ?? 0),
      near_gap: String(rule.near_gap ?? 2000),
      reward_type: rule.reward_type || "message",
      reward_value: String(rule.reward_value ?? 0),
      message_template: rule.message_template || "",
      unlocked_message: rule.unlocked_message || ""
    });
    setFormError("");
    setModalOpen(true);
  };

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const payload = {
      code: form.code,
      name: form.name,
      rule_type: form.rule_type,
      is_active: form.is_active,
      sort_order: Number(form.sort_order || 0),
      channel: form.channel,
      points_per_amount: Number(form.points_per_amount || 1),
      amount_unit: Number(form.amount_unit || 100),
      min_lifetime_spend: Number(form.min_lifetime_spend || 0),
      min_order_count: Number(form.min_order_count || 0),
      near_gap: Number(form.near_gap || 2000),
      reward_type: form.reward_type,
      reward_value: Number(form.reward_value || 0),
      message_template: form.message_template || null,
      unlocked_message: form.unlocked_message || null
    };
    const result = editing
      ? await adminFetch(`/api/admin/loyalty/rules/${editing.id}`, {
          method: "PATCH",
          json: payload
        })
      : await adminFetch("/api/admin/loyalty/rules", { method: "POST", json: payload });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setModalOpen(false);
    await reload();
  };

  const toggleActive = async (rule: LoyaltyRule) => {
    await adminFetch(`/api/admin/loyalty/rules/${rule.id}`, {
      method: "PATCH",
      json: { is_active: !rule.is_active }
    });
    await reload();
  };

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow="Sukadhaa"
        title="Loyalty rules"
        description="Central customers (website + store). Points and milestone offers update live for checkout and POS bills."
        actions={
          <button type="button" className="btn" onClick={openCreate}>
            <Plus size={16} />
            New rule
          </button>
        }
      />

      {error ? <AdminAlert>{error}</AdminAlert> : null}
      {loading ? <AdminLoading /> : null}

      {!loading && !(data || []).length ? (
        <AdminEmpty title="No loyalty rules" body="Add earn rates or spend / visit milestones." />
      ) : null}

      <div className="admin-card-grid">
        {(data || []).map((rule) => (
          <AdminPanel
            key={rule.id}
            title={rule.name}
            actions={
              <>
                <AdminBadge tone={statusTone(rule.is_active ? "active" : "draft")}>
                  {rule.is_active ? "Active" : "Off"}
                </AdminBadge>
                <button type="button" className="btn ghost" onClick={() => openEdit(rule)}>
                  Edit
                </button>
                <button type="button" className="btn ghost" onClick={() => void toggleActive(rule)}>
                  {rule.is_active ? "Disable" : "Enable"}
                </button>
              </>
            }
          >
            <p className="muted">
              <code>{rule.code}</code> · {rule.rule_type} · {rule.channel}
            </p>
            {rule.rule_type === "earn_rate" ? (
              <p>
                Earn {rule.points_per_amount} pt per ₹{rule.amount_unit}
              </p>
            ) : null}
            {rule.rule_type === "spend_milestone" ? (
              <p>
                Spend ≥ ₹{rule.min_lifetime_spend} → {rule.reward_value}
                {rule.reward_type === "percent" ? "%" : ""} · near gap ₹{rule.near_gap}
              </p>
            ) : null}
            {rule.rule_type === "visit_count" ? (
              <p>{rule.min_order_count}+ paid orders unlock</p>
            ) : null}
            {rule.message_template ? <p className="muted">{rule.message_template}</p> : null}
          </AdminPanel>
        ))}
      </div>

      <AdminFormModal
        open={modalOpen}
        title={editing ? "Edit loyalty rule" : "New loyalty rule"}
        onClose={() => setModalOpen(false)}
      >
        <form className="admin-form-grid" onSubmit={onSave}>
          {formError ? <AdminAlert>{formError}</AdminAlert> : null}
          <label>
            Code
            <input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              required
            />
          </label>
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label>
            Type
            <select
              value={form.rule_type}
              onChange={(e) => setForm((f) => ({ ...f, rule_type: e.target.value }))}
            >
              <option value="earn_rate">Earn rate</option>
              <option value="spend_milestone">Spend milestone</option>
              <option value="visit_count">Visit count</option>
            </select>
          </label>
          <label>
            Channel
            <select
              value={form.channel}
              onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
            >
              <option value="all">All</option>
              <option value="online">Website</option>
              <option value="pos">Store</option>
            </select>
          </label>
          {form.rule_type === "earn_rate" ? (
            <>
              <label>
                Points per unit
                <input
                  type="number"
                  value={form.points_per_amount}
                  onChange={(e) => setForm((f) => ({ ...f, points_per_amount: e.target.value }))}
                />
              </label>
              <label>
                Amount unit (₹)
                <input
                  type="number"
                  value={form.amount_unit}
                  onChange={(e) => setForm((f) => ({ ...f, amount_unit: e.target.value }))}
                />
              </label>
            </>
          ) : null}
          {form.rule_type === "spend_milestone" ? (
            <>
              <label>
                Min lifetime spend (₹)
                <input
                  type="number"
                  value={form.min_lifetime_spend}
                  onChange={(e) => setForm((f) => ({ ...f, min_lifetime_spend: e.target.value }))}
                />
              </label>
              <label>
                Near gap (₹)
                <input
                  type="number"
                  value={form.near_gap}
                  onChange={(e) => setForm((f) => ({ ...f, near_gap: e.target.value }))}
                />
              </label>
              <label>
                Reward type
                <select
                  value={form.reward_type}
                  onChange={(e) => setForm((f) => ({ ...f, reward_type: e.target.value }))}
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed ₹</option>
                  <option value="points">Points</option>
                  <option value="message">Message only</option>
                </select>
              </label>
              <label>
                Reward value
                <input
                  type="number"
                  value={form.reward_value}
                  onChange={(e) => setForm((f) => ({ ...f, reward_value: e.target.value }))}
                />
              </label>
            </>
          ) : null}
          {form.rule_type === "visit_count" ? (
            <label>
              Min paid orders
              <input
                type="number"
                value={form.min_order_count}
                onChange={(e) => setForm((f) => ({ ...f, min_order_count: e.target.value }))}
              />
            </label>
          ) : null}
          <label className="admin-form-span">
            Near / progress message
            <textarea
              rows={2}
              value={form.message_template}
              onChange={(e) => setForm((f) => ({ ...f, message_template: e.target.value }))}
            />
          </label>
          <label className="admin-form-span">
            Unlocked message
            <textarea
              rows={2}
              value={form.unlocked_message}
              onChange={(e) => setForm((f) => ({ ...f, unlocked_message: e.target.value }))}
            />
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Active
          </label>
          <div className="admin-form-actions">
            <button type="button" className="btn ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </AdminFormModal>
    </div>
  );
}
