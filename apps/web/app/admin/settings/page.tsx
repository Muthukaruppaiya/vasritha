"use client";

import { FormEvent, useEffect, useState } from "react";
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
import { adminFetch, formatDate } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";
import { ROLE_META, ROLE_ORDER, type AppRole } from "../../../lib/auth/rbac";

type Settings = {
  site_name: string | null;
  tagline: string | null;
  support_email: string | null;
  support_phone: string | null;
  whatsapp_number: string | null;
  currency: string | null;
  free_shipping_min: string | null;
  seo_title: string | null;
  seo_description: string | null;
  company_legal_name: string | null;
  company_address: string | null;
  company_gstin: string | null;
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
  const [tab, setTab] = useState<"site" | "company" | "roles">("site");
  const { data, error, loading, reload } = useAdminQuery<Settings>("/api/admin/settings");
  const rolesQuery = useAdminQuery<RoleRow[]>("/api/admin/roles");
  const [form, setForm] = useState<Settings>({
    site_name: "",
    tagline: "",
    support_email: "",
    support_phone: "",
    whatsapp_number: "",
    currency: "INR",
    free_shipping_min: "0",
    seo_title: "",
    seo_description: "",
    company_legal_name: "",
    company_address: "",
    company_gstin: ""
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
      seo_title: data.seo_title || "",
      seo_description: data.seo_description || "",
      company_legal_name: data.company_legal_name || data.site_name || "",
      company_address: data.company_address || "",
      company_gstin: data.company_gstin || ""
    });
  }, [data]);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setSaveError("");
    const result = await adminFetch("/api/admin/settings", {
      method: "PATCH",
      json: {
        ...form,
        free_shipping_min: Number(form.free_shipping_min || 0)
      }
    });
    setSaving(false);
    if (result.error) setSaveError(result.error);
    else {
      setMessage(tab === "company" ? "Company details saved." : "Settings saved.");
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
        eyebrow=""
        title="Settings"
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
              + New role
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
                <span>Free shipping min</span>
                <input
                  type="number"
                  min="0"
                  value={form.free_shipping_min || ""}
                  onChange={(e) => setForm((f) => ({ ...f, free_shipping_min: e.target.value }))}
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
                  onChange={(e) => setForm((f) => ({ ...f, company_gstin: e.target.value.toUpperCase() }))}
                  placeholder="22AAAAA0000A1Z5"
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
          )}
        </AdminPanel>
      )}

      {tab === "roles" && (
        <>
          <AdminPanel title="Roles & rights (spec)">
            <div className="admin-table-wrap">
              <table className="admin-table roles-matrix-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Purpose</th>
                    <th>Typical permissions</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLE_ORDER.map((code) => {
                    const meta = ROLE_META[code as AppRole];
                    return (
                      <tr key={code}>
                        <td>
                          <b>{meta.name}</b>
                          <div className="muted admin-sub">{code}</div>
                        </td>
                        <td>{meta.purpose}</td>
                        <td>{meta.typicalPermissions}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
                          <td>{role.code}</td>
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
