"use client";

import { FormEvent, useMemo, useState } from "react";
import { Ban, Pencil, Plus } from "lucide-react";
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

type Supplier = {
  id: string;
  code: string;
  name: string;
  trade_name: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  pincode: string | null;
  gstin: string | null;
  pan: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
};

const blankForm = () => ({
  code: "",
  name: "",
  trade_name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  state_code: "",
  pincode: "",
  gstin: "",
  pan: "",
  bank_name: "",
  bank_account: "",
  bank_ifsc: "",
  payment_terms: "",
  notes: "",
  is_active: true
});

export default function AdminSuppliersPage() {
  const { data, error, loading, reload } = useAdminQuery<Supplier[]>("/api/admin/suppliers");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data || [];
    if (!q) return list;
    return list.filter((row) => {
      const hay = [
        row.name,
        row.trade_name,
        row.code,
        row.gstin,
        row.pan,
        row.phone,
        row.city,
        row.state
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setActionError("");
    setModalOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setForm({
      code: supplier.code,
      name: supplier.name,
      trade_name: supplier.trade_name || "",
      contact_person: supplier.contact_person || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      city: supplier.city || "",
      state: supplier.state || "",
      state_code: supplier.state_code || "",
      pincode: supplier.pincode || "",
      gstin: supplier.gstin || "",
      pan: supplier.pan || "",
      bank_name: supplier.bank_name || "",
      bank_account: supplier.bank_account || "",
      bank_ifsc: supplier.bank_ifsc || "",
      payment_terms: supplier.payment_terms || "",
      notes: supplier.notes || "",
      is_active: supplier.is_active
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
      ...(editing ? { code: form.code.trim().toUpperCase() } : {}),
      name: form.name.trim(),
      trade_name: form.trade_name.trim() || null,
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      state_code: form.state_code.trim() || null,
      pincode: form.pincode.trim() || null,
      gstin: form.gstin.trim().toUpperCase() || null,
      pan: form.pan.trim().toUpperCase() || null,
      bank_name: form.bank_name.trim() || null,
      bank_account: form.bank_account.trim() || null,
      bank_ifsc: form.bank_ifsc.trim().toUpperCase() || null,
      payment_terms: form.payment_terms.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active
    };

    const result = editing
      ? await adminFetch(`/api/admin/suppliers/${editing.id}`, { method: "PATCH", json: payload })
      : await adminFetch("/api/admin/suppliers", { method: "POST", json: payload });

    setSaving(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setModalOpen(false);
    setMessage(editing ? "Supplier updated." : "Supplier added. It is available in GRN.");
    reload();
  };

  const deactivate = async (supplier: Supplier) => {
    if (!confirm(`Deactivate supplier “${supplier.name}”?`)) return;
    setActionError("");
    const result = await adminFetch(`/api/admin/suppliers/${supplier.id}`, { method: "DELETE" });
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setMessage("Supplier deactivated (or removed if unused).");
    reload();
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Purchases"
        title="Supplier Master"
        description="Maintain suppliers with GSTIN, PAN, and bank details. Select them when posting GRN / inward stock."
        actions={
          <button type="button" className="btn" onClick={openCreate}>
            <Plus size={15} />
            Add supplier
          </button>
        }
      />

      {error && <AdminAlert>{error}</AdminAlert>}
      {actionError && <AdminAlert>{actionError}</AdminAlert>}
      {message && <AdminAlert tone="ok">{message}</AdminAlert>}

      <AdminPanel
        title="Suppliers"
        actions={
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, GSTIN, PAN…"
            style={{ minWidth: 220 }}
          />
        }
      >
        {loading && <AdminLoading />}
        {!loading && !rows.length && (
          <AdminEmpty
            title="No suppliers yet"
            body="Add your fabric / garment vendors here so GRN can pick them with tax details."
          />
        )}
        {!loading && rows.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Code</th>
                  <th>GSTIN / PAN</th>
                  <th>Contact</th>
                  <th>State</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <b>{supplier.name}</b>
                      {supplier.trade_name ? (
                        <div className="muted admin-sub">{supplier.trade_name}</div>
                      ) : null}
                      {supplier.address ? (
                        <div className="muted admin-sub">{supplier.address}</div>
                      ) : null}
                    </td>
                    <td>
                      <code>{supplier.code}</code>
                    </td>
                    <td>
                      <div>{supplier.gstin || "—"}</div>
                      <div className="muted admin-sub">PAN: {supplier.pan || "—"}</div>
                    </td>
                    <td>
                      <div>{supplier.contact_person || "—"}</div>
                      <div className="muted admin-sub">{supplier.phone || ""}</div>
                      <div className="muted admin-sub">{supplier.email || ""}</div>
                    </td>
                    <td>
                      <div>{supplier.state || "—"}</div>
                      <div className="muted admin-sub">
                        {[supplier.state_code, supplier.city, supplier.pincode]
                          .filter(Boolean)
                          .join(" · ") || ""}
                      </div>
                    </td>
                    <td>
                      <AdminBadge tone={supplier.is_active ? "success" : "danger"}>
                        {supplier.is_active ? "Active" : "Inactive"}
                      </AdminBadge>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button type="button" className="admin-action-btn" onClick={() => openEdit(supplier)}>
                          <Pencil size={15} strokeWidth={2} />
                          <span>Edit</span>
                        </button>
                        {supplier.is_active ? (
                          <button
                            type="button"
                            className="admin-action-btn"
                            onClick={() => void deactivate(supplier)}
                          >
                            <Ban size={15} strokeWidth={2} />
                            <span>Deactivate</span>
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
      </AdminPanel>

      <AdminFormModal
        open={modalOpen}
        title={editing ? "Edit supplier" : "Add supplier"}
        eyebrow="Supplier Master"
        submitLabel={editing ? "Save supplier" : "Create supplier"}
        savingLabel="Saving…"
        saving={saving}
        error={actionError}
        onClose={() => setModalOpen(false)}
        onSubmit={onSubmit}
      >
        <label>
          <span>Code</span>
          <input
            value={editing ? form.code : "Auto (SUP-0001…)"}
            readOnly
            disabled
            title={editing ? "Supplier code" : "Generated automatically on save"}
          />
        </label>
        <label>
          <span>Legal name *</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="As on GST / invoice"
          />
        </label>
        <label>
          <span>Trade name</span>
          <input
            value={form.trade_name}
            onChange={(e) => setForm((f) => ({ ...f, trade_name: e.target.value }))}
            placeholder="Optional brand / shop name"
          />
        </label>
        <label>
          <span>Contact person</span>
          <input
            value={form.contact_person}
            onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
          />
        </label>
        <label>
          <span>Phone</span>
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="10-digit mobile"
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
        <label className="admin-span-2">
          <span>Address</span>
          <input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </label>
        <label>
          <span>City</span>
          <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        </label>
        <label>
          <span>Pincode</span>
          <input
            value={form.pincode}
            onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
          />
        </label>
        <label>
          <span>State</span>
          <input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
        </label>
        <label>
          <span>State code</span>
          <input
            value={form.state_code}
            onChange={(e) => setForm((f) => ({ ...f, state_code: e.target.value }))}
            placeholder="Auto from GSTIN if blank"
          />
        </label>
        <label>
          <span>GSTIN</span>
          <input
            value={form.gstin}
            onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
            placeholder="15-character GST number"
            maxLength={15}
          />
        </label>
        <label>
          <span>PAN</span>
          <input
            value={form.pan}
            onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value.toUpperCase() }))}
            placeholder="e.g. ABCDE1234F"
            maxLength={10}
          />
        </label>
        <label>
          <span>Bank name</span>
          <input
            value={form.bank_name}
            onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
          />
        </label>
        <label>
          <span>Bank account</span>
          <input
            value={form.bank_account}
            onChange={(e) => setForm((f) => ({ ...f, bank_account: e.target.value }))}
          />
        </label>
        <label>
          <span>IFSC</span>
          <input
            value={form.bank_ifsc}
            onChange={(e) => setForm((f) => ({ ...f, bank_ifsc: e.target.value.toUpperCase() }))}
          />
        </label>
        <label>
          <span>Payment terms</span>
          <input
            value={form.payment_terms}
            onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))}
            placeholder="e.g. Net 15 / Advance"
          />
        </label>
        <label className="admin-span-2">
          <span>Notes</span>
          <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </label>
        <label className="admin-span-2" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          <span>Active (available in GRN)</span>
        </label>
      </AdminFormModal>
    </>
  );
}
