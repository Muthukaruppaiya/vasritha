"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  slugify
} from "../../../components/admin/admin-ui";
import { AdminFormModal } from "../../../components/admin/admin-form-modal";
import { adminFetch, adminUpload, formatDate } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";
import { ROLE_META, ROLE_ORDER, type AppRole } from "../../../lib/auth/rbac";

type Settings = {
  site_name: string | null;
  tagline: string | null;
  logo_path?: string | null;
  header_logo_path?: string | null;
  support_email: string | null;
  support_phone: string | null;
  whatsapp_number: string | null;
  currency: string | null;
  free_shipping_min: string | null;
  default_shipping_fee?: string | null;
  delivery_enabled?: boolean | null;
  estimated_delivery_text?: string | null;
  order_processing_text?: string | null;
  shipping_policy_notes?: string | null;
  delivery_pincode_mode?: string | null;
  delivery_pincodes?: string | null;
  category_shipping_combine_mode?: string | null;
  no_refund_policy?: boolean | null;
  exchange_enabled?: boolean | null;
  exchange_window_days?: string | number | null;
  exchange_charge?: string | null;
  exchange_condition_text?: string | null;
  exchange_non_eligible_text?: string | null;
  exchange_process_text?: string | null;
  exchange_policy_notes?: string | null;
  in_store_exchange_refund_only?: boolean | null;
  in_store_policy_text?: string | null;
  seo_title: string | null;
  seo_description: string | null;
  company_legal_name: string | null;
  company_address: string | null;
  company_gstin: string | null;
  company_state: string | null;
  company_state_code: string | null;
  staff_login_security_enabled?: boolean;
  staff_login_require_ip?: boolean;
  staff_login_require_device?: boolean;
  staff_login_require_geo?: boolean;
  staff_login_allowed_ips?: string | null;
  staff_login_store_lat?: string | number | null;
  staff_login_store_lng?: string | number | null;
  staff_login_store_radius_m?: number | null;
};

type LoginDevice = {
  id: string;
  device_key: string;
  label: string | null;
  user_agent: string | null;
  last_ip: string | null;
  status: string;
  last_seen_at: string | null;
  created_at: string;
};

type RoleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permission_template: string | null;
  created_at: string;
};

const SYSTEM_TEMPLATES = ROLE_ORDER.filter((code) => code !== "customer").map((code) => ({
  code,
  name: ROLE_META[code].name
}));

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<"site" | "company" | "roles" | "security">("site");
  const { data, error, loading, reload } = useAdminQuery<Settings>("/api/admin/settings");
  const rolesQuery = useAdminQuery<RoleRow[]>("/api/admin/roles");
  const devicesQuery = useAdminQuery<LoginDevice[]>("/api/admin/settings/login-devices");
  const [form, setForm] = useState<Settings>({
    site_name: "",
    tagline: "",
    support_email: "",
    support_phone: "",
    whatsapp_number: "",
    currency: "INR",
    free_shipping_min: "0",
    default_shipping_fee: "0",
    delivery_enabled: true,
    estimated_delivery_text: "3–7 business days across India",
    order_processing_text: "Orders are packed within 1–2 business days after payment confirmation",
    shipping_policy_notes: "",
    delivery_pincode_mode: "all",
    delivery_pincodes: "",
    category_shipping_combine_mode: "max",
    no_refund_policy: true,
    exchange_enabled: true,
    exchange_window_days: "7",
    exchange_charge: "0",
    exchange_condition_text: "",
    exchange_non_eligible_text: "",
    exchange_process_text: "",
    exchange_policy_notes: "",
    in_store_exchange_refund_only: true,
    in_store_policy_text:
      "In-store purchases can be exchanged or refunded only at the physical store. Online orders follow the exchange-only (no refund) policy.",
    seo_title: "",
    seo_description: "",
    company_legal_name: "",
    company_address: "",
    company_gstin: "",
    company_state: "",
    company_state_code: "",
    staff_login_security_enabled: false,
    staff_login_require_ip: false,
    staff_login_require_device: false,
    staff_login_require_geo: false,
    staff_login_allowed_ips: "",
    staff_login_store_lat: "",
    staff_login_store_lng: "",
    staff_login_store_radius_m: 300
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const [roleForm, setRoleForm] = useState({
    name: "",
    code: "",
    description: "",
    permissionTemplate: "manager"
  });
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [logoBusy, setLogoBusy] = useState<"header" | "logo" | null>(null);
  const [logoMessage, setLogoMessage] = useState("");
  const [logoError, setLogoError] = useState("");

  useEffect(() => {
    if (!data) return;
    setForm({
      site_name: data.site_name || "",
      tagline: data.tagline || "",
      support_email: data.support_email || "",
      support_phone: data.support_phone || "",
      whatsapp_number: data.whatsapp_number || "",
      currency: data.currency || "INR",
      free_shipping_min: data.free_shipping_min ?? "0",
      default_shipping_fee: data.default_shipping_fee ?? "0",
      delivery_enabled: data.delivery_enabled !== false,
      estimated_delivery_text: data.estimated_delivery_text ?? "3–7 business days across India",
      order_processing_text:
        data.order_processing_text ??
        "Orders are packed within 1–2 business days after payment confirmation",
      shipping_policy_notes: data.shipping_policy_notes ?? "",
      delivery_pincode_mode: data.delivery_pincode_mode ?? "all",
      delivery_pincodes: data.delivery_pincodes ?? "",
      category_shipping_combine_mode: data.category_shipping_combine_mode ?? "max",
      no_refund_policy: data.no_refund_policy !== false,
      exchange_enabled: data.exchange_enabled !== false,
      exchange_window_days: String(data.exchange_window_days ?? 7),
      exchange_charge: data.exchange_charge ?? "0",
      exchange_condition_text: data.exchange_condition_text ?? "",
      exchange_non_eligible_text: data.exchange_non_eligible_text ?? "",
      exchange_process_text: data.exchange_process_text ?? "",
      exchange_policy_notes: data.exchange_policy_notes ?? "",
      in_store_exchange_refund_only: data.in_store_exchange_refund_only !== false,
      in_store_policy_text:
        data.in_store_policy_text ??
        "In-store purchases can be exchanged or refunded only at the physical store. Online orders follow the exchange-only (no refund) policy.",
      seo_title: data.seo_title || "",
      seo_description: data.seo_description || "",
      company_legal_name: data.company_legal_name || data.site_name || "",
      company_address: data.company_address || "",
      company_gstin: data.company_gstin || "",
      company_state: data.company_state || "",
      company_state_code: data.company_state_code || "",
      staff_login_security_enabled: Boolean(data.staff_login_security_enabled),
      staff_login_require_ip: Boolean(data.staff_login_require_ip),
      staff_login_require_device: Boolean(data.staff_login_require_device),
      staff_login_require_geo: Boolean(data.staff_login_require_geo),
      staff_login_allowed_ips: data.staff_login_allowed_ips || "",
      staff_login_store_lat: data.staff_login_store_lat ?? "",
      staff_login_store_lng: data.staff_login_store_lng ?? "",
      staff_login_store_radius_m: data.staff_login_store_radius_m ?? 300
    });
  }, [data]);

  const onUploadLogo = async (kind: "header" | "logo", fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;

    setLogoBusy(kind);
    setLogoMessage("");
    setLogoError("");

    if (kind === "header" && file.type !== "image/svg+xml") {
      setLogoBusy(null);
      setLogoError("Header logo must be an SVG file.");
      return;
    }

    const body = new FormData();
    body.append("kind", kind);
    body.append("file", file);
    const result = await adminUpload("/api/admin/settings/logo", body);
    setLogoBusy(null);

    if (result.error) {
      setLogoError(result.error);
      return;
    }

    setLogoMessage(
      kind === "header"
        ? "Header logo updated (website header only)."
        : "Company logo updated (admin and other surfaces)."
    );
    await reload();
  };

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setSaveError("");
    const result = await adminFetch("/api/admin/settings", {
      method: "PATCH",
      json: {
        ...form,
        free_shipping_min: Number(form.free_shipping_min || 0),
        default_shipping_fee: Number(form.default_shipping_fee || 0),
        delivery_enabled: Boolean(form.delivery_enabled),
        estimated_delivery_text: form.estimated_delivery_text || null,
        order_processing_text: form.order_processing_text || null,
        shipping_policy_notes: form.shipping_policy_notes || null,
        delivery_pincode_mode: form.delivery_pincode_mode || "all",
        delivery_pincodes: form.delivery_pincodes || "",
        category_shipping_combine_mode:
          form.category_shipping_combine_mode === "sum" ? "sum" : "max",
        no_refund_policy: Boolean(form.no_refund_policy),
        exchange_enabled: Boolean(form.exchange_enabled),
        exchange_window_days: Number(form.exchange_window_days || 7),
        exchange_charge: Number(form.exchange_charge || 0),
        exchange_condition_text: form.exchange_condition_text || null,
        exchange_non_eligible_text: form.exchange_non_eligible_text || null,
        exchange_process_text: form.exchange_process_text || null,
        exchange_policy_notes: form.exchange_policy_notes || null,
        in_store_exchange_refund_only: Boolean(form.in_store_exchange_refund_only),
        in_store_policy_text: form.in_store_policy_text || null,
        staff_login_security_enabled: Boolean(form.staff_login_security_enabled),
        staff_login_require_ip: Boolean(form.staff_login_require_ip),
        staff_login_require_device: Boolean(form.staff_login_require_device),
        staff_login_require_geo: Boolean(form.staff_login_require_geo),
        staff_login_allowed_ips: form.staff_login_allowed_ips || "",
        staff_login_store_lat:
          form.staff_login_store_lat === "" || form.staff_login_store_lat == null
            ? null
            : Number(form.staff_login_store_lat),
        staff_login_store_lng:
          form.staff_login_store_lng === "" || form.staff_login_store_lng == null
            ? null
            : Number(form.staff_login_store_lng),
        staff_login_store_radius_m: Number(form.staff_login_store_radius_m || 300)
      }
    });
    setSaving(false);
    if (result.error) setSaveError(result.error);
    else {
      setMessage(
        tab === "company"
          ? "Company details saved."
          : tab === "security"
            ? "Login security saved."
            : "Settings saved."
      );
      await reload();
    }
  };

  const onCreateRole = async (event: FormEvent) => {
    event.preventDefault();
    setRoleSaving(true);
    setRoleError("");
    const result = await adminFetch("/api/admin/roles", {
      method: "POST",
      json: {
        name: roleForm.name,
        code: roleForm.code || slugify(roleForm.name).replace(/-/g, "_"),
        description: roleForm.description || null,
        permissionTemplate: roleForm.permissionTemplate
      }
    });
    setRoleSaving(false);
    if (result.error) {
      setRoleError(result.error);
      return;
    }
    setRoleModalOpen(false);
    setRoleForm({
      name: "",
      code: "",
      description: "",
      permissionTemplate: "manager"
    });
    await rolesQuery.reload();
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Store setup"
        title="Settings"
        description="Site identity, company details, logos, and staff roles."
        actions={
          tab === "roles" ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setRoleError("");
                setRoleForm({
                  name: "",
                  code: "",
                  description: "",
                  permissionTemplate: "manager"
                });
                setRoleModalOpen(true);
              }}
            >
              <Plus size={15} />
              New role
            </button>
          ) : null
        }
      />

      <div className="admin-tabs">
        <button type="button" className={tab === "site" ? "is-active" : ""} onClick={() => setTab("site")}>
          Site
        </button>
        <button
          type="button"
          className={tab === "company" ? "is-active" : ""}
          onClick={() => {
            setMessage("");
            setSaveError("");
            setTab("company");
          }}
        >
          Company
        </button>
        <button
          type="button"
          className={tab === "roles" ? "is-active" : ""}
          onClick={() => setTab("roles")}
        >
          Roles
        </button>
        <button
          type="button"
          className={tab === "security" ? "is-active" : ""}
          onClick={() => {
            setMessage("");
            setSaveError("");
            setTab("security");
            void devicesQuery.reload();
          }}
        >
          Login security
        </button>
      </div>

      {tab === "site" && (
        <AdminPanel title="Site settings">
          {loading && <AdminLoading />}
          {error && <AdminAlert>{error}</AdminAlert>}
          {!loading && !error && (
            <form className="admin-form-grid" onSubmit={onSave}>
              <label>
                <span>Site name</span>
                <input
                  value={form.site_name || ""}
                  onChange={(e) => setForm((f) => ({ ...f, site_name: e.target.value }))}
                />
              </label>
              <label>
                <span>Tagline</span>
                <input
                  value={form.tagline || ""}
                  onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                />
              </label>
              <label>
                <span>Currency</span>
                <input
                  value={form.currency || ""}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                />
              </label>
              <label>
                <span>Free delivery minimum (₹)</span>
                <input
                  type="number"
                  min="0"
                  value={form.free_shipping_min || ""}
                  onChange={(e) => setForm((f) => ({ ...f, free_shipping_min: e.target.value }))}
                />
              </label>
              <label>
                <span>Delivery charge (₹)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.default_shipping_fee || ""}
                  onChange={(e) => setForm((f) => ({ ...f, default_shipping_fee: e.target.value }))}
                />
              </label>
              <label>
                <span>Multi-category shipping rule</span>
                <select
                  value={form.category_shipping_combine_mode || "max"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category_shipping_combine_mode: e.target.value }))
                  }
                >
                  <option value="max">Highest category rate (one shipment)</option>
                  <option value="sum">Sum all category rates</option>
                </select>
                <span className="muted admin-sub">
                  Set per-category rates under Categories. Free-shipping minimum still zeros delivery
                  when the cart qualifies.
                </span>
              </label>
              <label>
                <span>Online delivery</span>
                <select
                  value={form.delivery_enabled === false ? "0" : "1"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, delivery_enabled: e.target.value === "1" }))
                  }
                >
                  <option value="1">Enabled</option>
                  <option value="0">Disabled</option>
                </select>
              </label>
              <label>
                <span>PIN code rules</span>
                <select
                  value={form.delivery_pincode_mode || "all"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, delivery_pincode_mode: e.target.value }))
                  }
                >
                  <option value="all">Deliver all India</option>
                  <option value="allowlist">Only listed PINs</option>
                  <option value="blocklist">Block listed PINs</option>
                </select>
              </label>
              <label className="admin-span-2">
                <span>Estimated delivery text</span>
                <input
                  value={form.estimated_delivery_text || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, estimated_delivery_text: e.target.value }))
                  }
                  placeholder="e.g. 3–7 business days across India"
                />
              </label>
              <label className="admin-span-2">
                <span>Order processing time</span>
                <input
                  value={form.order_processing_text || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, order_processing_text: e.target.value }))
                  }
                  placeholder="e.g. Packed within 1–2 business days after payment"
                />
              </label>
              <label className="admin-span-2">
                <span>Shipping policy notes</span>
                <textarea
                  rows={3}
                  value={form.shipping_policy_notes || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, shipping_policy_notes: e.target.value }))
                  }
                  placeholder="Extra conditions shown on the Shipping Policy page"
                />
              </label>

              <div className="admin-span-2">
                <h3 style={{ margin: "8px 0 4px" }}>Exchange &amp; refund policy</h3>
                <p className="muted" style={{ marginTop: 0 }}>
                  Boutique rule: NO cash refunds. Customers may request exchanges only.
                </p>
              </div>
              <label>
                <span>No refund policy</span>
                <select
                  value={form.no_refund_policy === false ? "0" : "1"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, no_refund_policy: e.target.value === "1" }))
                  }
                >
                  <option value="1">Enabled (block refunds)</option>
                  <option value="0">Disabled</option>
                </select>
              </label>
              <label>
                <span>Exchanges</span>
                <select
                  value={form.exchange_enabled === false ? "0" : "1"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, exchange_enabled: e.target.value === "1" }))
                  }
                >
                  <option value="1">Enabled</option>
                  <option value="0">Disabled</option>
                </select>
              </label>
              <label>
                <span>Exchange window (days after delivery)</span>
                <input
                  type="number"
                  min="0"
                  value={form.exchange_window_days || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, exchange_window_days: e.target.value }))
                  }
                />
              </label>
              <label>
                <span>Exchange charge (₹)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.exchange_charge || ""}
                  onChange={(e) => setForm((f) => ({ ...f, exchange_charge: e.target.value }))}
                />
              </label>
              <label className="admin-span-2">
                <span>Condition requirements</span>
                <textarea
                  rows={2}
                  value={form.exchange_condition_text || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, exchange_condition_text: e.target.value }))
                  }
                />
              </label>
              <label className="admin-span-2">
                <span>Non-exchangeable products</span>
                <textarea
                  rows={2}
                  value={form.exchange_non_eligible_text || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, exchange_non_eligible_text: e.target.value }))
                  }
                />
              </label>
              <label className="admin-span-2">
                <span>Exchange process</span>
                <textarea
                  rows={2}
                  value={form.exchange_process_text || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, exchange_process_text: e.target.value }))
                  }
                />
              </label>
              <label className="admin-span-2">
                <span>Extra exchange notes</span>
                <textarea
                  rows={2}
                  value={form.exchange_policy_notes || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, exchange_policy_notes: e.target.value }))
                  }
                />
              </label>
              <label>
                <span>In-store exchange/refund only at store</span>
                <select
                  value={form.in_store_exchange_refund_only === false ? "0" : "1"}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      in_store_exchange_refund_only: e.target.value === "1"
                    }))
                  }
                >
                  <option value="1">Enabled (show store-only rule)</option>
                  <option value="0">Disabled</option>
                </select>
              </label>
              <label className="admin-span-2">
                <span>In-store purchase condition text</span>
                <textarea
                  rows={2}
                  value={form.in_store_policy_text || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, in_store_policy_text: e.target.value }))
                  }
                  placeholder="In-store purchases can be exchanged or refunded only at the physical store…"
                />
              </label>

              <label className="admin-span-2">
                <span>PIN list (comma or newline)</span>
                <textarea
                  rows={3}
                  value={form.delivery_pincodes || ""}
                  onChange={(e) => setForm((f) => ({ ...f, delivery_pincodes: e.target.value }))}
                  placeholder="600001, 560001…"
                />
              </label>
              <label>
                <span>SEO title</span>
                <input
                  value={form.seo_title || ""}
                  onChange={(e) => setForm((f) => ({ ...f, seo_title: e.target.value }))}
                />
              </label>
              <label className="admin-span-2">
                <span>SEO description</span>
                <textarea
                  rows={3}
                  value={form.seo_description || ""}
                  onChange={(e) => setForm((f) => ({ ...f, seo_description: e.target.value }))}
                />
              </label>
              {saveError && <AdminAlert>{saveError}</AdminAlert>}
              {message && <AdminAlert tone="ok">{message}</AdminAlert>}
              <div className="admin-span-2">
                <button className="btn" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save settings"}
                </button>
              </div>
            </form>
          )}
        </AdminPanel>
      )}

      {tab === "company" && (
        <AdminPanel title="Company details">
          {loading && <AdminLoading />}
          {error && <AdminAlert>{error}</AdminAlert>}
          {!loading && !error && (
            <>
              <div className="admin-logo-grid">
                <div className="admin-logo-card">
                  <h3>Website header logo</h3>
                  <p className="muted">SVG only, original brand colours. Shown in the storefront header.</p>
                  <div className="admin-logo-preview admin-logo-preview--header">
                    {data?.header_logo_path || data?.logo_path ? (
                      <img
                        src={data.header_logo_path || data.logo_path || ""}
                        alt="Header logo"
                      />
                    ) : (
                      <span className="muted">No header logo yet</span>
                    )}
                  </div>
                  <label className="admin-file-btn">
                    <span>{logoBusy === "header" ? "Uploading…" : "Upload SVG"}</span>
                    <input
                      type="file"
                      accept="image/svg+xml,.svg"
                      disabled={logoBusy !== null}
                      onChange={(e) => {
                        void onUploadLogo("header", e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                <div className="admin-logo-card">
                  <h3>Company / brand logo</h3>
                  <p className="muted">JPEG, PNG, WebP or GIF. Used in admin and other places.</p>
                  <div className="admin-logo-preview">
                    {data?.logo_path ? (
                      <img src={data.logo_path} alt="Company logo" />
                    ) : (
                      <span className="muted">No company logo yet</span>
                    )}
                  </div>
                  <label className="admin-file-btn">
                    <span>{logoBusy === "logo" ? "Uploading…" : "Upload image"}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={logoBusy !== null}
                      onChange={(e) => {
                        void onUploadLogo("logo", e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
              {logoError && <AdminAlert>{logoError}</AdminAlert>}
              {logoMessage && <AdminAlert tone="ok">{logoMessage}</AdminAlert>}

              <form className="admin-form-grid" onSubmit={onSave}>
                <label className="admin-span-2">
                  <span>Legal / registered name</span>
                  <input
                    value={form.company_legal_name || ""}
                    onChange={(e) => setForm((f) => ({ ...f, company_legal_name: e.target.value }))}
                    placeholder="Vasritha Boutique LLP"
                  />
                </label>
                <label className="admin-span-2">
                  <span>Registered address</span>
                  <textarea
                    rows={3}
                    value={form.company_address || ""}
                    onChange={(e) => setForm((f) => ({ ...f, company_address: e.target.value }))}
                    placeholder="Street, area, city, state, PIN"
                  />
                </label>
                <label>
                  <span>Phone</span>
                  <input
                    value={form.support_phone || ""}
                    onChange={(e) => setForm((f) => ({ ...f, support_phone: e.target.value }))}
                    placeholder="+91…"
                  />
                </label>
                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.support_email || ""}
                    onChange={(e) => setForm((f) => ({ ...f, support_email: e.target.value }))}
                  />
                </label>
                <label>
                  <span>GSTIN</span>
                  <input
                    value={form.company_gstin || ""}
                    onChange={(e) => {
                      const gstin = e.target.value.toUpperCase();
                      setForm((f) => ({
                        ...f,
                        company_gstin: gstin,
                        company_state_code:
                          f.company_state_code ||
                          (/^\d{2}/.test(gstin) ? gstin.slice(0, 2) : f.company_state_code)
                      }));
                    }}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </label>
                <label>
                  <span>State</span>
                  <input
                    value={form.company_state || ""}
                    onChange={(e) => setForm((f) => ({ ...f, company_state: e.target.value }))}
                    placeholder="e.g. Tamil Nadu"
                  />
                </label>
                <label>
                  <span>GST state code</span>
                  <input
                    value={form.company_state_code || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        company_state_code: e.target.value.replace(/\D/g, "").slice(0, 2)
                      }))
                    }
                    placeholder="33"
                    maxLength={2}
                    inputMode="numeric"
                  />
                </label>
                <label>
                  <span>Support WhatsApp</span>
                  <input
                    value={form.whatsapp_number || ""}
                    onChange={(e) => setForm((f) => ({ ...f, whatsapp_number: e.target.value }))}
                    placeholder="919000000000"
                  />
                </label>
                {saveError && <AdminAlert>{saveError}</AdminAlert>}
                {message && <AdminAlert tone="ok">{message}</AdminAlert>}
                <div className="admin-span-2">
                  <button className="btn" type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save company details"}
                  </button>
                </div>
              </form>
            </>
          )}
        </AdminPanel>
      )}

      {tab === "security" && (
        <AdminPanel title="Staff login security">
          {loading && <AdminLoading />}
          {error && <AdminAlert>{error}</AdminAlert>}
          {!loading && !error && (
            <form className="admin-form-grid" onSubmit={onSave}>
              <AdminAlert tone="ok">
                Applies only to staff / POS login (ops domain, e.g. Sukadhaa). The public website
                (e.g. Vasritha) is never checked. Keep the master switch OFF while testing.
              </AdminAlert>

              <label className="admin-check-row">
                <input
                  type="checkbox"
                  checked={Boolean(form.staff_login_security_enabled)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, staff_login_security_enabled: e.target.checked }))
                  }
                />
                <span>
                  <strong>Enable staff login security</strong>
                  <small className="admin-field-hint">Master switch — when off, IP / device / geo checks are ignored.</small>
                </span>
              </label>

              <label className="admin-check-row">
                <input
                  type="checkbox"
                  disabled={!form.staff_login_security_enabled}
                  checked={Boolean(form.staff_login_require_ip)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, staff_login_require_ip: e.target.checked }))
                  }
                />
                <span>
                  <strong>Require store IP</strong>
                  <small className="admin-field-hint">Most reliable if the shop has a fixed internet IP.</small>
                </span>
              </label>

              <label>
                <span>Allowed IPs (one per line)</span>
                <textarea
                  rows={4}
                  disabled={!form.staff_login_security_enabled || !form.staff_login_require_ip}
                  value={form.staff_login_allowed_ips || ""}
                  onChange={(e) => setForm((f) => ({ ...f, staff_login_allowed_ips: e.target.value }))}
                  placeholder={"103.94.27.75\n103.94.27."}
                />
              </label>

              <label className="admin-check-row">
                <input
                  type="checkbox"
                  disabled={!form.staff_login_security_enabled}
                  checked={Boolean(form.staff_login_require_device)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, staff_login_require_device: e.target.checked }))
                  }
                />
                <span>
                  <strong>Require approved device</strong>
                  <small className="admin-field-hint">Good for known store PCs/phones. First device auto-approves.</small>
                </span>
              </label>

              <label className="admin-check-row">
                <input
                  type="checkbox"
                  disabled={!form.staff_login_security_enabled}
                  checked={Boolean(form.staff_login_require_geo)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, staff_login_require_geo: e.target.checked }))
                  }
                />
                <span>
                  <strong>Require store location (GPS)</strong>
                  <small className="admin-field-hint">Least reliable — staff can deny location; use as extra layer only.</small>
                </span>
              </label>

              <label>
                <span>Store latitude</span>
                <input
                  type="number"
                  step="any"
                  disabled={!form.staff_login_security_enabled || !form.staff_login_require_geo}
                  value={form.staff_login_store_lat ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, staff_login_store_lat: e.target.value }))}
                />
              </label>
              <label>
                <span>Store longitude</span>
                <input
                  type="number"
                  step="any"
                  disabled={!form.staff_login_security_enabled || !form.staff_login_require_geo}
                  value={form.staff_login_store_lng ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, staff_login_store_lng: e.target.value }))}
                />
              </label>
              <label>
                <span>Allowed radius (metres)</span>
                <input
                  type="number"
                  min={50}
                  disabled={!form.staff_login_security_enabled || !form.staff_login_require_geo}
                  value={form.staff_login_store_radius_m ?? 300}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, staff_login_store_radius_m: Number(e.target.value || 300) }))
                  }
                />
              </label>

              {message ? <AdminAlert tone="ok">{message}</AdminAlert> : null}
              {saveError ? <AdminAlert>{saveError}</AdminAlert> : null}
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save login security"}
              </button>
            </form>
          )}

          <div className="admin-soft-card" style={{ marginTop: 24 }}>
            <h3>Registered devices</h3>
            <p className="muted">Approve or block browsers/PCs used for staff login.</p>
            {devicesQuery.loading && <AdminLoading />}
            {devicesQuery.error && <AdminAlert>{devicesQuery.error}</AdminAlert>}
            {!devicesQuery.loading && !(devicesQuery.data || []).length ? (
              <AdminEmpty title="No devices yet" body="Devices appear here after a staff login attempt." />
            ) : null}
            <ul className="admin-child-list">
              {(devicesQuery.data || []).map((device) => (
                <li key={device.id}>
                  <div>
                    <strong>{device.label || "Store device"}</strong>
                    <p className="muted">
                      {device.status} · {device.last_ip || "no IP"} · {device.device_key.slice(0, 8)}…
                    </p>
                  </div>
                  <span className="admin-row-actions">
                    <AdminBadge tone={device.status === "approved" ? "success" : device.status === "blocked" ? "danger" : "warn"}>
                      {device.status}
                    </AdminBadge>
                    {device.status !== "approved" ? (
                      <button
                        type="button"
                        className="admin-action-btn admin-action-btn--compact"
                        onClick={() =>
                          void adminFetch("/api/admin/settings/login-devices", {
                            method: "PATCH",
                            json: { id: device.id, status: "approved" }
                          }).then(() => devicesQuery.reload())
                        }
                      >
                        Approve
                      </button>
                    ) : null}
                    {device.status !== "blocked" ? (
                      <button
                        type="button"
                        className="admin-action-btn admin-action-btn--danger admin-action-btn--compact"
                        onClick={() =>
                          void adminFetch("/api/admin/settings/login-devices", {
                            method: "PATCH",
                            json: { id: device.id, status: "blocked" }
                          }).then(() => devicesQuery.reload())
                        }
                      >
                        Block
                      </button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </AdminPanel>
      )}

      {tab === "roles" && (
        <>
          <AdminPanel title="Roles & rights (spec)">
            <p className="roles-spec-lead muted">
              Staff access is organised by role. Each role unlocks only the modules and actions listed
              below.
            </p>
            <div className="roles-spec-grid">
              {ROLE_ORDER.filter((code) => code !== "customer" && code !== "accountant").map(
                (code) => {
                  const meta = ROLE_META[code as AppRole];
                  const permissions = meta.typicalPermissions
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean);
                  return (
                    <article key={code} className="roles-spec-card">
                      <div className="roles-spec-card-head">
                        <div>
                          <h3>{meta.name}</h3>
                          <code>{code}</code>
                        </div>
                        {meta.mvp ? <AdminBadge tone="success">MVP</AdminBadge> : null}
                      </div>
                      <p className="roles-spec-purpose">{meta.purpose}</p>
                      <div className="roles-spec-perms">
                        {permissions.map((permission) => (
                          <span key={permission} className="roles-spec-chip">
                            {permission}
                          </span>
                        ))}
                      </div>
                      <p className="roles-spec-restricted muted">
                        Restricted from: {meta.restrictedFrom}
                      </p>
                    </article>
                  );
                }
              )}
            </div>

            <div className="roles-spec-extra">
              <h4>Extended roles</h4>
              <div className="roles-spec-extra-list">
                {(["accountant", "customer"] as AppRole[]).map((code) => {
                  const meta = ROLE_META[code];
                  return (
                    <div key={code} className="roles-spec-extra-item">
                      <div>
                        <strong>{meta.name}</strong>
                        <code>{code}</code>
                      </div>
                      <p>{meta.purpose}</p>
                      <span className="muted">{meta.typicalPermissions}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </AdminPanel>

          <AdminPanel title="Configured roles">
            {rolesQuery.loading && <AdminLoading />}
            {rolesQuery.error && <AdminAlert>{rolesQuery.error}</AdminAlert>}
            {!rolesQuery.loading && !(rolesQuery.data || []).length && (
              <AdminEmpty title="No roles found" />
            )}
            {(rolesQuery.data || []).length > 0 && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>Type</th>
                      <th>Permissions from</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rolesQuery.data || []).map((role) => {
                      const meta = ROLE_META[role.code as AppRole];
                      return (
                        <tr key={role.id}>
                          <td>
                            <b>{role.name}</b>
                            <div className="muted admin-sub">
                              {meta?.purpose || role.description || "—"}
                            </div>
                          </td>
                          <td>
                            <code className="roles-code">{role.code}</code>
                          </td>
                          <td>
                            <AdminBadge tone={role.is_system ? "info" : "success"}>
                              {role.is_system ? "system" : "custom"}
                            </AdminBadge>
                          </td>
                          <td>{role.permission_template || role.code}</td>
                          <td>{formatDate(role.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </AdminPanel>

          <AdminFormModal
            open={roleModalOpen}
            title="Add role"
            eyebrow="Access control"
            submitLabel="Create role"
            savingLabel="Creating…"
            saving={roleSaving}
            error={roleError}
            onClose={() => setRoleModalOpen(false)}
            onSubmit={onCreateRole}
          >
            <label>
              <span>Role name</span>
              <input
                required
                value={roleForm.name}
                onChange={(e) =>
                  setRoleForm((f) => ({
                    ...f,
                    name: e.target.value,
                    code: f.code || slugify(e.target.value).replace(/-/g, "_")
                  }))
                }
                placeholder="Store Supervisor"
              />
            </label>
            <label>
              <span>Code</span>
              <input
                required
                value={roleForm.code}
                onChange={(e) =>
                  setRoleForm((f) => ({
                    ...f,
                    code: slugify(e.target.value).replace(/-/g, "_")
                  }))
                }
                placeholder="store_supervisor"
              />
            </label>
            <label className="admin-span-2">
              <span>Permission template</span>
              <select
                value={roleForm.permissionTemplate}
                onChange={(e) =>
                  setRoleForm((f) => ({ ...f, permissionTemplate: e.target.value }))
                }
              >
                {SYSTEM_TEMPLATES.map((role) => (
                  <option key={role.code} value={role.code}>
                    Based on {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-span-2">
              <span>Description</span>
              <textarea
                rows={2}
                value={roleForm.description}
                onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
          </AdminFormModal>
        </>
      )}
    </>
  );
}
