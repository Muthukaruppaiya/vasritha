"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, Store } from "lucide-react";
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

type Shop = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  state: string | null;
  state_code: string | null;
  gstin: string | null;
  is_active: boolean;
  is_default: boolean;
  notes: string | null;
  created_at: string;
};

const blankForm = () => ({
  code: "",
  name: "",
  address: "",
  phone: "",
  email: "",
  state: "",
  state_code: "",
  gstin: "",
  notes: "",
  is_active: true,
  is_default: false
});

export default function AdminShopsPage() {
  const { data, error, loading, reload } = useAdminQuery<Shop[]>("/api/admin/shops");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Shop | null>(null);
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

  const openEdit = (shop: Shop) => {
    setEditing(shop);
    setForm({
      code: shop.code,
      name: shop.name,
      address: shop.address || "",
      phone: shop.phone || "",
      email: shop.email || "",
      state: shop.state || "",
      state_code: shop.state_code || "",
      gstin: shop.gstin || "",
      notes: shop.notes || "",
      is_active: shop.is_active,
      is_default: shop.is_default
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
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      state: form.state.trim() || null,
      state_code: form.state_code.trim() || null,
      gstin: form.gstin.trim().toUpperCase() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
      is_default: form.is_default
    };

    const result = editing
      ? await adminFetch(`/api/admin/shops/${editing.id}`, { method: "PATCH", json: payload })
      : await adminFetch("/api/admin/shops", { method: "POST", json: payload });

    setSaving(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setModalOpen(false);
    setMessage(editing ? "Shop updated." : "Shop added. You can select it on POS billing.");
    reload();
  };

  const setAsDefault = async (shop: Shop) => {
    setActionError("");
    const result = await adminFetch(`/api/admin/shops/${shop.id}`, {
      method: "PATCH",
      json: { is_default: true, is_active: true }
    });
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setMessage(`${shop.name} is now the default shop.`);
    reload();
  };

  const deactivate = async (shop: Shop) => {
    if (!confirm(`Deactivate shop “${shop.name}”? Existing bills stay linked to it.`)) return;
    setActionError("");
    const result = await adminFetch(`/api/admin/shops/${shop.id}`, { method: "DELETE" });
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setMessage("Shop deactivated (or removed if unused).");
    reload();
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="System"
        title="Shops"
        description="Add more store locations over time. POS bills and stock movements can be tagged to a shop."
        actions={
          <button type="button" className="btn" onClick={openCreate}>
            <Plus size={15} />
            Add shop
          </button>
        }
      />

      {error && <AdminAlert>{error}</AdminAlert>}
      {actionError && <AdminAlert>{actionError}</AdminAlert>}
      {message && <AdminAlert tone="ok">{message}</AdminAlert>}

      <AdminPanel title="Store locations">
        {loading && <AdminLoading />}
        {!loading && !rows.length && (
          <AdminEmpty title="No shops yet" body="Add your main store to start multi-location ready billing." />
        )}
        {!loading && rows.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>Shop</th>
                  <th>Code</th>
                  <th>GSTIN / State</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((shop) => (
                  <tr key={shop.id}>
                    <td>
                      <b>{shop.name}</b>
                      {shop.address ? <div className="muted admin-sub">{shop.address}</div> : null}
                    </td>
                    <td>
                      <code>{shop.code}</code>
                    </td>
                    <td>
                      <div>{shop.gstin || "— (company GSTIN)"}</div>
                      <div className="muted admin-sub">
                        {shop.state || "—"}
                        {shop.state_code ? ` · ${shop.state_code}` : ""}
                      </div>
                    </td>
                    <td>
                      <div>{shop.phone || "—"}</div>
                      <div className="muted admin-sub">{shop.email || ""}</div>
                    </td>
                    <td>
                      <div className="admin-inline-badges">
                        <AdminBadge tone={shop.is_active ? "success" : "warn"}>
                          {shop.is_active ? "Active" : "Inactive"}
                        </AdminBadge>
                        {shop.is_default ? <AdminBadge tone="info">Default</AdminBadge> : null}
                      </div>
                    </td>
                    <td>
                      <div className="inv-row-actions">
                        <button type="button" className="admin-action-btn" onClick={() => openEdit(shop)}>
                          Edit
                        </button>
                        {!shop.is_default && shop.is_active ? (
                          <button
                            type="button"
                            className="admin-action-btn admin-action-btn--primary"
                            onClick={() => void setAsDefault(shop)}
                          >
                            Set default
                          </button>
                        ) : null}
                        {shop.is_active ? (
                          <button type="button" className="admin-action-btn" onClick={() => void deactivate(shop)}>
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
          <Store size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
          Catalogue stock stays shared for now. When you open a second shop, bills already carry{" "}
          <b>shop_id</b> so per-shop stock can be layered later without rework.
        </p>
      </AdminPanel>

      <AdminFormModal
        open={modalOpen}
        title={editing ? "Edit shop" : "Add shop"}
        onClose={() => setModalOpen(false)}
        onSubmit={onSubmit}
        saving={saving}
        error={actionError}
      >
        <label>
          <span>Shop name</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Vasritha — Tirupur Main"
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
                code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24)
              }))
            }
            placeholder="MAIN"
          />
        </label>
        <label className="admin-span-2">
          <span>Address</span>
          <textarea
            rows={2}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Street, area, city, PIN"
          />
        </label>
        <label>
          <span>Phone</span>
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </label>
        <label>
          <span>GSTIN (optional)</span>
          <input
            value={form.gstin}
            onChange={(e) => {
              const gstin = e.target.value.toUpperCase();
              setForm((f) => ({
                ...f,
                gstin,
                state_code:
                  f.state_code || (/^\d{2}/.test(gstin) ? gstin.slice(0, 2) : f.state_code)
              }));
            }}
            placeholder="Leave blank to use company GSTIN"
          />
        </label>
        <label>
          <span>State</span>
          <input
            value={form.state}
            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            placeholder="Tamil Nadu"
          />
        </label>
        <label>
          <span>State code</span>
          <input
            value={form.state_code}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                state_code: e.target.value.replace(/\D/g, "").slice(0, 2)
              }))
            }
            maxLength={2}
            placeholder="33"
          />
        </label>
        <label className="admin-span-2">
          <span>Notes</span>
          <input
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Opening soon / mall counter…"
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
          <span>Default POS shop</span>
        </label>
      </AdminFormModal>
    </>
  );
}
