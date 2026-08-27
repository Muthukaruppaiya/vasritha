"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../components/admin/admin-ui";
import { AdminFormModal } from "../../../components/admin/admin-form-modal";
import { adminFetch } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";
import { OPS_PLATFORM_NAME } from "../../../lib/platform";

type Brand = {
  id: string;
  code: string;
  name: string;
  slug: string;
  tagline: string | null;
  support_email: string | null;
  support_phone: string | null;
  website_url: string | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  notes: string | null;
};

const blankForm = () => ({
  code: "",
  name: "",
  slug: "",
  tagline: "",
  support_email: "",
  support_phone: "",
  website_url: "",
  notes: "",
  is_active: true,
  is_default: false,
  sort_order: "0"
});

export default function AdminBrandsPage() {
  const { data, error, loading, reload } = useAdminQuery<Brand[]>("/api/admin/brands");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");

  const rows = useMemo(() => data || [], [data]);

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setActionError("");
    setModalOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditing(brand);
    setForm({
      code: brand.code,
      name: brand.name,
      slug: brand.slug,
      tagline: brand.tagline || "",
      support_email: brand.support_email || "",
      support_phone: brand.support_phone || "",
      website_url: brand.website_url || "",
      notes: brand.notes || "",
      is_active: brand.is_active,
      is_default: brand.is_default,
      sort_order: String(brand.sort_order ?? 0)
    });
    setActionError("");
    setModalOpen(true);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    setMessage("");

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      tagline: form.tagline.trim() || null,
      support_email: form.support_email.trim() || null,
      support_phone: form.support_phone.trim() || null,
      website_url: form.website_url.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
      is_default: form.is_default,
      sort_order: Number(form.sort_order) || 0
    };

    const result = editing
      ? await adminFetch(`/api/admin/brands/${editing.id}`, { method: "PATCH", json: payload })
      : await adminFetch("/api/admin/brands", { method: "POST", json: payload });

    setSaving(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setModalOpen(false);
    setMessage(editing ? "Brand updated." : "Brand plugin added.");
    reload();
  };

  const setAsDefault = async (brand: Brand) => {
    setActionError("");
    const result = await adminFetch(`/api/admin/brands/${brand.id}`, {
      method: "PATCH",
      json: { is_default: true, is_active: true }
    });
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setMessage(`${brand.name} is now the default sales brand.`);
    reload();
  };

  const deactivate = async (brand: Brand) => {
    if (!confirm(`Deactivate brand “${brand.name}”? Existing products/orders stay linked.`)) return;
    setActionError("");
    const result = await adminFetch(`/api/admin/brands/${brand.id}`, { method: "DELETE" });
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setMessage("Brand deactivated (or removed if unused).");
    reload();
  };

  return (
    <>
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Brands"
        description="Sales brand plugins. Customer storefronts use these names; internal ops stay Sukadhaa."
        actions={
          <button type="button" className="btn" onClick={openCreate}>
            <Plus size={15} />
            Add brand
          </button>
        }
      />

      {error && <AdminAlert>{error}</AdminAlert>}
      {actionError && <AdminAlert>{actionError}</AdminAlert>}
      {message && <AdminAlert tone="ok">{message}</AdminAlert>}

      <AdminPanel title="Brand plugins">
        {loading && <AdminLoading />}
        {!loading && !rows.length && (
          <AdminEmpty
            title="No brands yet"
            body="Add Vasritha (or another sales brand) as a plugin on Sukadhaa."
          />
        )}
        {!loading && rows.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Code / slug</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((brand) => (
                  <tr key={brand.id}>
                    <td>
                      <b>{brand.name}</b>
                      {brand.tagline ? <div className="muted admin-sub">{brand.tagline}</div> : null}
                    </td>
                    <td>
                      <code>{brand.code}</code>
                      <div className="muted admin-sub">/{brand.slug}</div>
                    </td>
                    <td>
                      <div>{brand.support_phone || "—"}</div>
                      <div className="muted admin-sub">{brand.support_email || ""}</div>
                    </td>
                    <td>
                      <div className="admin-inline-badges">
                        <AdminBadge tone={brand.is_active ? "success" : "warn"}>
                          {brand.is_active ? "Active" : "Inactive"}
                        </AdminBadge>
                        {brand.is_default ? <AdminBadge tone="info">Default</AdminBadge> : null}
                      </div>
                    </td>
                    <td>
                      <div className="inv-row-actions">
                        <button type="button" className="admin-action-btn" onClick={() => openEdit(brand)}>
                          Edit
                        </button>
                        {!brand.is_default && brand.is_active ? (
                          <button
                            type="button"
                            className="admin-action-btn admin-action-btn--primary"
                            onClick={() => void setAsDefault(brand)}
                          >
                            Set default
                          </button>
                        ) : null}
                        {brand.is_active ? (
                          <button
                            type="button"
                            className="admin-action-btn"
                            onClick={() => void deactivate(brand)}
                          >
                            Deactivate
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ marginTop: 12 }}>
          <Sparkles size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
          {OPS_PLATFORM_NAME} runs inventory, POS, and staff tools. Each brand (Vasritha today) is a
          sales face customers see online and on bills.
        </p>
      </AdminPanel>

      <AdminFormModal
        open={modalOpen}
        title={editing ? "Edit brand" : "Add brand plugin"}
        eyebrow={OPS_PLATFORM_NAME}
        onClose={() => setModalOpen(false)}
        onSubmit={onSubmit}
        saving={saving}
        error={actionError}
      >
        <label>
          <span>Brand name</span>
          <input
            required
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              setForm((f) => ({
                ...f,
                name,
                slug:
                  editing || f.slug
                    ? f.slug
                    : name
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, ""),
                code:
                  editing || f.code
                    ? f.code
                    : name
                        .toUpperCase()
                        .replace(/[^A-Z0-9_-]/g, "")
                        .slice(0, 32)
              }));
            }}
            placeholder="Vasritha"
          />
        </label>
        <label>
          <span>Code</span>
          <input
            required
            value={form.code}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32)
              }))
            }
            placeholder="VASRITHA"
          />
        </label>
        <label>
          <span>Slug</span>
          <input
            required
            value={form.slug}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                slug: e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "")
                  .slice(0, 64)
              }))
            }
            placeholder="vasritha"
          />
        </label>
        <label>
          <span>Tagline</span>
          <input
            value={form.tagline}
            onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
            placeholder="Timeless Elegance"
          />
        </label>
        <label>
          <span>Support phone</span>
          <input
            value={form.support_phone}
            onChange={(e) => setForm((f) => ({ ...f, support_phone: e.target.value }))}
          />
        </label>
        <label>
          <span>Support email</span>
          <input
            type="email"
            value={form.support_email}
            onChange={(e) => setForm((f) => ({ ...f, support_email: e.target.value }))}
          />
        </label>
        <label className="admin-span-2">
          <span>Website URL</span>
          <input
            value={form.website_url}
            onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
            placeholder="https://"
          />
        </label>
        <label className="admin-span-2">
          <span>Notes</span>
          <input
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Launch soon / second brand…"
          />
        </label>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          <span>Active</span>
        </label>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
          />
          <span>Default sales brand</span>
        </label>
      </AdminFormModal>
    </>
  );
}
