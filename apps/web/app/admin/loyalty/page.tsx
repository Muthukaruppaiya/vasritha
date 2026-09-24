"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Power } from "lucide-react";
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
import { adminFetch, adminUpload } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";
import { OPS_PLATFORM_NAME } from "../../../lib/platform";

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

type PopupForm = {
  enabled: boolean;
  title: string;
  message: string;
  image_path: string;
  guest_cta_label: string;
  guest_cta_href: string;
  login_cta_label: string;
  member_cta_label: string;
  member_cta_href: string;
  delay_ms: string;
  show_once_per_session: boolean;
  homepage_only: boolean;
};

const RULE_TYPE_LABEL: Record<string, string> = {
  earn_rate: "Earn points",
  spend_milestone: "Spend milestone",
  visit_count: "Visit count"
};

const CHANNEL_LABEL: Record<string, string> = {
  all: "Website + store",
  online: "Website only",
  pos: "Store only"
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

const blankPopup = (): PopupForm => ({
  enabled: true,
  title: "Vasritha Loyalty",
  message: "Join our loyalty program and get exclusive offers!",
  image_path: "",
  guest_cta_label: "Join Now",
  guest_cta_href: "/account/register",
  login_cta_label: "Login",
  member_cta_label: "View my account",
  member_cta_href: "/account",
  delay_ms: "4500",
  show_once_per_session: true,
  homepage_only: true
});

function fmtNum(value: string | number | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

function ruleSummary(rule: LoyaltyRule) {
  if (rule.rule_type === "earn_rate") {
    return `Earn ${fmtNum(rule.points_per_amount)} pt per ₹${fmtNum(rule.amount_unit)}`;
  }
  if (rule.rule_type === "spend_milestone") {
    const reward =
      rule.reward_type === "percent"
        ? `${fmtNum(rule.reward_value)}% off`
        : rule.reward_type === "fixed"
          ? `₹${fmtNum(rule.reward_value)} off`
          : rule.reward_type === "points"
            ? `${fmtNum(rule.reward_value)} points`
            : "loyalty thank-you";
    return `Lifetime spend ₹${fmtNum(rule.min_lifetime_spend)} → ${reward}`;
  }
  if (rule.rule_type === "visit_count") {
    return `${rule.min_order_count}+ paid orders unlock thank-you`;
  }
  return rule.name;
}

function fillTemplate(template: string | null | undefined, rule: LoyaltyRule) {
  if (!template?.trim()) return null;
  return template
    .replaceAll("{points}", "12")
    .replaceAll("{remaining}", "1,250")
    .replaceAll("{reward_value}", fmtNum(rule.reward_value))
    .replaceAll("{threshold}", fmtNum(rule.min_lifetime_spend))
    .replaceAll("{visits}", String(rule.min_order_count || 3));
}

export default function AdminLoyaltyPage() {
  const { data, error, loading, reload } = useAdminQuery<LoyaltyRule[]>(
    "/api/admin/loyalty/rules"
  );
  const rows = useMemo(
    () => [...(data || [])].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [data]
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LoyaltyRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(blankForm);
  const [popupForm, setPopupForm] = useState<PopupForm>(blankPopup);
  const [popupLoading, setPopupLoading] = useState(true);
  const [popupSaving, setPopupSaving] = useState(false);
  const [popupMsg, setPopupMsg] = useState("");
  const [popupErr, setPopupErr] = useState("");
  const [popupUploadBusy, setPopupUploadBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setPopupLoading(true);
      const result = await adminFetch<PopupForm & { image_path?: string | null; delay_ms?: number }>(
        "/api/admin/loyalty/popup"
      );
      if (cancelled) return;
      if (result.data) {
        const d = result.data;
        setPopupForm({
          enabled: d.enabled !== false,
          title: d.title || blankPopup().title,
          message: d.message || blankPopup().message,
          image_path: d.image_path || "",
          guest_cta_label: d.guest_cta_label || blankPopup().guest_cta_label,
          guest_cta_href: d.guest_cta_href || blankPopup().guest_cta_href,
          login_cta_label: d.login_cta_label || blankPopup().login_cta_label,
          member_cta_label: d.member_cta_label || blankPopup().member_cta_label,
          member_cta_href: d.member_cta_href || blankPopup().member_cta_href,
          delay_ms: String(d.delay_ms ?? 4500),
          show_once_per_session: d.show_once_per_session !== false,
          homepage_only: d.homepage_only !== false
        });
      }
      setPopupLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
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
      message_template: form.message_template.trim() || null,
      unlocked_message: form.unlocked_message.trim() || null
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
    setTogglingId(rule.id);
    await adminFetch(`/api/admin/loyalty/rules/${rule.id}`, {
      method: "PATCH",
      json: { is_active: !rule.is_active }
    });
    setTogglingId(null);
    await reload();
  };

  const onSavePopup = async (event: FormEvent) => {
    event.preventDefault();
    setPopupSaving(true);
    setPopupMsg("");
    setPopupErr("");
    const result = await adminFetch("/api/admin/loyalty/popup", {
      method: "PATCH",
      json: {
        enabled: popupForm.enabled,
        title: popupForm.title,
        message: popupForm.message,
        image_path: popupForm.image_path || null,
        guest_cta_label: popupForm.guest_cta_label,
        guest_cta_href: popupForm.guest_cta_href,
        login_cta_label: popupForm.login_cta_label,
        member_cta_label: popupForm.member_cta_label,
        member_cta_href: popupForm.member_cta_href,
        delay_ms: Number(popupForm.delay_ms || 4500),
        show_once_per_session: popupForm.show_once_per_session,
        homepage_only: popupForm.homepage_only
      }
    });
    setPopupSaving(false);
    if (result.error) {
      setPopupErr(result.error);
      return;
    }
    setPopupMsg("Loyalty popup settings saved.");
  };

  const onUploadPopupImage = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setPopupUploadBusy(true);
    setPopupErr("");
    const fd = new FormData();
    fd.set("file", file);
    const uploaded = await adminUpload<{ path: string }>("/api/admin/loyalty/popup/image", fd);
    setPopupUploadBusy(false);
    if (uploaded.error || !uploaded.data?.path) {
      setPopupErr(uploaded.error || "Upload failed");
      return;
    }
    setPopupForm((f) => ({ ...f, image_path: uploaded.data!.path }));
  };

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Loyalty"
        description="Rules for points and milestones, plus the storefront loyalty popup."
        actions={
          <button type="button" className="btn" onClick={openCreate}>
            <Plus size={16} />
            New rule
          </button>
        }
      />

      {error ? <AdminAlert>{error}</AdminAlert> : null}

      <AdminPanel title="Storefront loyalty popup">
        {popupLoading ? <AdminLoading /> : null}
        {!popupLoading ? (
          <form className="admin-form-grid" onSubmit={onSavePopup}>
            {popupErr ? (
              <div className="admin-span-2">
                <AdminAlert>{popupErr}</AdminAlert>
              </div>
            ) : null}
            {popupMsg ? (
              <p className="muted admin-span-2" style={{ margin: 0 }}>
                {popupMsg}
              </p>
            ) : null}
            <label>
              <span>Status</span>
              <select
                value={popupForm.enabled ? "1" : "0"}
                onChange={(e) =>
                  setPopupForm((f) => ({ ...f, enabled: e.target.value === "1" }))
                }
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </label>
            <label>
              <span>Delay before show (ms)</span>
              <input
                type="number"
                min="0"
                max="60000"
                step="100"
                value={popupForm.delay_ms}
                onChange={(e) => setPopupForm((f) => ({ ...f, delay_ms: e.target.value }))}
              />
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={popupForm.show_once_per_session}
                onChange={(e) =>
                  setPopupForm((f) => ({ ...f, show_once_per_session: e.target.checked }))
                }
              />
              Once per browser session
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={popupForm.homepage_only}
                onChange={(e) =>
                  setPopupForm((f) => ({ ...f, homepage_only: e.target.checked }))
                }
              />
              Homepage only
            </label>
            <label className="admin-span-2">
              <span>Title</span>
              <input
                value={popupForm.title}
                onChange={(e) => setPopupForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </label>
            <label className="admin-span-2">
              <span>Message</span>
              <textarea
                rows={2}
                value={popupForm.message}
                onChange={(e) => setPopupForm((f) => ({ ...f, message: e.target.value }))}
                required
              />
            </label>
            <label className="admin-span-2">
              <span>Banner image (optional)</span>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  style={{ flex: 1, minWidth: 180 }}
                  value={popupForm.image_path}
                  onChange={(e) => setPopupForm((f) => ({ ...f, image_path: e.target.value }))}
                  placeholder="/uploads/… or leave blank"
                />
                <label className="btn btn-ghost" style={{ cursor: "pointer", margin: 0 }}>
                  {popupUploadBusy ? "Uploading…" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={popupUploadBusy}
                    onChange={(e) => {
                      void onUploadPopupImage(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </label>
            <label>
              <span>Guest button</span>
              <input
                value={popupForm.guest_cta_label}
                onChange={(e) =>
                  setPopupForm((f) => ({ ...f, guest_cta_label: e.target.value }))
                }
              />
            </label>
            <label>
              <span>Guest button link</span>
              <input
                value={popupForm.guest_cta_href}
                onChange={(e) => setPopupForm((f) => ({ ...f, guest_cta_href: e.target.value }))}
              />
            </label>
            <label>
              <span>Login button</span>
              <input
                value={popupForm.login_cta_label}
                onChange={(e) =>
                  setPopupForm((f) => ({ ...f, login_cta_label: e.target.value }))
                }
              />
            </label>
            <label>
              <span>Member button</span>
              <input
                value={popupForm.member_cta_label}
                onChange={(e) =>
                  setPopupForm((f) => ({ ...f, member_cta_label: e.target.value }))
                }
              />
            </label>
            <label className="admin-span-2">
              <span>Member button link</span>
              <input
                value={popupForm.member_cta_href}
                onChange={(e) =>
                  setPopupForm((f) => ({ ...f, member_cta_href: e.target.value }))
                }
              />
            </label>
            <div className="admin-span-2">
              <button type="submit" className="btn" disabled={popupSaving}>
                {popupSaving ? "Saving…" : "Save popup"}
              </button>
            </div>
          </form>
        ) : null}
      </AdminPanel>

      <AdminPanel title="Active program">
        {loading ? <AdminLoading /> : null}
        {!loading && !rows.length ? (
          <AdminEmpty title="No loyalty rules" body="Add earn rates or spend / visit milestones." />
        ) : null}
        {!loading && rows.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Type</th>
                  <th>Channel</th>
                  <th>How it works</th>
                  <th>Customer prompt</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((rule) => {
                  const prompt =
                    fillTemplate(rule.message_template, rule) ||
                    fillTemplate(rule.unlocked_message, rule);
                  return (
                    <tr key={rule.id}>
                      <td>
                        <b>{rule.name}</b>
                        <div className="muted admin-sub">
                          <code>{rule.code}</code>
                        </div>
                      </td>
                      <td>{RULE_TYPE_LABEL[rule.rule_type] || rule.rule_type}</td>
                      <td>{CHANNEL_LABEL[rule.channel] || rule.channel}</td>
                      <td>
                        <div>{ruleSummary(rule)}</div>
                        {rule.rule_type === "spend_milestone" ? (
                          <div className="muted admin-sub">
                            Near alert within ₹{fmtNum(rule.near_gap)}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {prompt ? (
                          <div className="loyalty-prompt-preview">{prompt}</div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <AdminBadge tone={statusTone(rule.is_active ? "active" : "draft")}>
                          {rule.is_active ? "Active" : "Off"}
                        </AdminBadge>
                      </td>
                      <td>
                        <div className="admin-row-actions" role="group" aria-label={`${rule.name} actions`}>
                          <button
                            type="button"
                            className="admin-action-btn"
                            data-tooltip="Edit rule"
                            aria-label={`Edit ${rule.name}`}
                            onClick={() => openEdit(rule)}
                          >
                            <Pencil size={14} strokeWidth={2} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className={`admin-action-btn${rule.is_active ? " admin-action-btn--danger" : " admin-action-btn--primary"}`}
                            data-tooltip={rule.is_active ? "Disable rule" : "Enable rule"}
                            aria-label={`${rule.is_active ? "Disable" : "Enable"} ${rule.name}`}
                            disabled={togglingId === rule.id}
                            onClick={() => void toggleActive(rule)}
                          >
                            <Power size={14} strokeWidth={2} />
                            <span>{rule.is_active ? "Disable" : "Enable"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="muted" style={{ marginTop: 12 }}>
          Prompts use live customer spend and visit counts. Tokens like {"{remaining}"} and{" "}
          {"{points}"} are filled at checkout / POS — the table shows a sample preview.
        </p>
      </AdminPanel>

      <AdminFormModal
        open={modalOpen}
        title={editing ? "Edit loyalty rule" : "New loyalty rule"}
        eyebrow={OPS_PLATFORM_NAME}
        onClose={() => setModalOpen(false)}
        onSubmit={onSave}
        saving={saving}
        error={formError}
        wide
      >
        <label>
          <span>Code</span>
          <input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="SPEND_5K_10PCT"
            required
          />
        </label>
        <label>
          <span>Name</span>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="₹5000 spend → 10% offer"
            required
          />
        </label>
        <label>
          <span>Type</span>
          <select
            value={form.rule_type}
            onChange={(e) => setForm((f) => ({ ...f, rule_type: e.target.value }))}
          >
            <option value="earn_rate">Earn points</option>
            <option value="spend_milestone">Spend milestone</option>
            <option value="visit_count">Visit count</option>
          </select>
        </label>
        <label>
          <span>Channel</span>
          <select
            value={form.channel}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
          >
            <option value="all">Website + store</option>
            <option value="online">Website only</option>
            <option value="pos">Store only</option>
          </select>
        </label>
        <label>
          <span>Sort order</span>
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
          />
        </label>
        {form.rule_type === "earn_rate" ? (
          <>
            <label>
              <span>Points per unit</span>
              <input
                type="number"
                value={form.points_per_amount}
                onChange={(e) => setForm((f) => ({ ...f, points_per_amount: e.target.value }))}
              />
            </label>
            <label>
              <span>Amount unit (₹)</span>
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
              <span>Min lifetime spend (₹)</span>
              <input
                type="number"
                value={form.min_lifetime_spend}
                onChange={(e) => setForm((f) => ({ ...f, min_lifetime_spend: e.target.value }))}
              />
            </label>
            <label>
              <span>Near gap (₹)</span>
              <input
                type="number"
                value={form.near_gap}
                onChange={(e) => setForm((f) => ({ ...f, near_gap: e.target.value }))}
              />
            </label>
            <label>
              <span>Reward type</span>
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
              <span>Reward value</span>
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
            <span>Min paid orders</span>
            <input
              type="number"
              value={form.min_order_count}
              onChange={(e) => setForm((f) => ({ ...f, min_order_count: e.target.value }))}
            />
          </label>
        ) : null}
        <label className="admin-form-span">
          <span>Near / progress message</span>
          <textarea
            rows={2}
            value={form.message_template}
            onChange={(e) => setForm((f) => ({ ...f, message_template: e.target.value }))}
            placeholder="Spend ₹{remaining} more to unlock {reward_value}% off."
          />
        </label>
        <label className="admin-form-span">
          <span>Unlocked message</span>
          <textarea
            rows={2}
            value={form.unlocked_message}
            onChange={(e) => setForm((f) => ({ ...f, unlocked_message: e.target.value }))}
            placeholder="Unlocked: {reward_value}% loyalty offer."
          />
        </label>
        <p className="muted admin-form-span" style={{ margin: 0, fontSize: "0.8rem" }}>
          Tokens: {"{remaining}"}, {"{points}"}, {"{reward_value}"}, {"{threshold}"}, {"{visits}"} —
          replaced automatically for each customer.
        </p>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          Active
        </label>
      </AdminFormModal>
    </div>
  );
}
