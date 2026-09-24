"use client";

import { FormEvent, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../components/admin/admin-ui";
import { AdminFormModal } from "../../../components/admin/admin-form-modal";
import { adminFetch, formatDate } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type RoleOption = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
};

type AdminUser = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  primaryRoleName: string;
  roles: Array<{ code: string; name: string }>;
};

const blankForm = () => ({
  fullName: "",
  email: "",
  phone: "",
  password: "",
  roleCode: "manager"
});

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState(blankForm);

  const path = useMemo(
    () => `/api/admin/users${submitted ? `?q=${encodeURIComponent(submitted)}` : ""}`,
    [submitted]
  );
  const { data, error, loading, reload } = useAdminQuery<AdminUser[]>(path);
  const { data: roles } = useAdminQuery<RoleOption[]>("/api/admin/roles");

  const staffRoles = (roles || []).filter((role) => role.code !== "customer");

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...blankForm(),
      roleCode: staffRoles[0]?.code || "manager"
    });
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    const staffOnlyRoles = user.roles.filter((role) => role.code !== "customer");
    setEditing(user);
    setForm({
      fullName: user.full_name,
      email: user.email,
      phone: user.phone || "",
      password: "",
      roleCode: staffOnlyRoles[0]?.code || staffRoles[0]?.code || "manager"
    });
    setFormError("");
    setModalOpen(true);
  };

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setActionError("");
    setActionMessage("");

    if (editing) {
      const result = await adminFetch("/api/admin/users", {
        method: "PATCH",
        json: {
          userId: editing.id,
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || null,
          roleCode: form.roleCode,
          ...(form.password.trim() ? { password: form.password.trim() } : {})
        }
      });
      setSaving(false);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setModalOpen(false);
      setEditing(null);
      setActionMessage("User updated.");
      await reload();
      return;
    }

    const result = await adminFetch("/api/admin/users", {
      method: "POST",
      json: {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        roleCode: form.roleCode
      }
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setModalOpen(false);
    setForm(blankForm());
    setActionMessage("User created.");
    await reload();
  };

  const onDelete = async (user: AdminUser) => {
    const ok = window.confirm(
      `Remove staff access for ${user.full_name}?\n\nThis deletes the account if they have no orders, or demotes them to customer if they do.`
    );
    if (!ok) return;
    setActionError("");
    setActionMessage("");
    setBusyId(user.id);
    const result = await adminFetch<{ deleted?: boolean; demoted?: boolean }>(
      "/api/admin/users",
      {
        method: "DELETE",
        json: { userId: user.id }
      }
    );
    setBusyId(null);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setActionMessage(
      result.data?.demoted
        ? `${user.full_name} removed from staff (kept as customer — has orders).`
        : `${user.full_name} deleted.`
    );
    await reload();
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Access"
        title="Users"
        description="Create, edit, and remove staff accounts. Assign roles for the admin panel."
        actions={
          <button type="button" className="btn" onClick={openCreate}>
            <Plus size={15} />
            New user
          </button>
        }
      />

      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q.trim());
        }}
      >
        <label className="admin-grow">
          <span>Search</span>
          <input
            placeholder="Name, email or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button className="btn" type="submit">
          Search
        </button>
      </form>

      {actionMessage ? <AdminAlert tone="ok">{actionMessage}</AdminAlert> : null}
      {actionError ? <AdminAlert>{actionError}</AdminAlert> : null}

      <AdminPanel title="Staff directory">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !(data || []).length && (
          <AdminEmpty title="No staff users found" body="Create a staff user to get started." />
        )}
        {(data || []).length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((user) => {
                  const staffOnlyRoles = user.roles.filter((role) => role.code !== "customer");
                  const displayRoles = staffOnlyRoles.length
                    ? staffOnlyRoles
                    : [{ code: "none", name: "No role" }];
                  return (
                    <tr key={user.id}>
                      <td>
                        <b>{user.full_name}</b>
                      </td>
                      <td>{user.email}</td>
                      <td>{user.phone || "—"}</td>
                      <td>
                        <div className="admin-row-actions">
                          {displayRoles.map((role) => (
                            <AdminBadge key={role.code} tone="info">
                              {role.name}
                            </AdminBadge>
                          ))}
                        </div>
                      </td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>
                        <div className="admin-row-actions" role="group" aria-label={`${user.full_name} actions`}>
                          <button
                            type="button"
                            className="admin-action-btn"
                            data-tooltip="Edit user"
                            aria-label={`Edit ${user.full_name}`}
                            disabled={busyId === user.id}
                            onClick={() => openEdit(user)}
                          >
                            <Pencil size={14} strokeWidth={2} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn admin-action-btn--danger"
                            data-tooltip="Delete user"
                            aria-label={`Delete ${user.full_name}`}
                            disabled={busyId === user.id}
                            onClick={() => void onDelete(user)}
                          >
                            <Trash2 size={14} strokeWidth={2} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      <AdminFormModal
        open={modalOpen}
        title={editing ? "Edit user" : "Add user"}
        eyebrow="Staff access"
        submitLabel={editing ? "Save changes" : "Create user"}
        savingLabel={editing ? "Saving…" : "Creating…"}
        saving={saving}
        error={formError}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={onSave}
      >
        <label>
          <span>Full name</span>
          <input
            required
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
        </label>
        <label>
          <span>Email</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
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
          <span>{editing ? "New password (optional)" : "Password"}</span>
          <input
            required={!editing}
            type="password"
            minLength={6}
            value={form.password}
            placeholder={editing ? "Leave blank to keep current" : undefined}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </label>
        <label className="admin-span-2">
          <span>Role</span>
          <select
            required
            value={form.roleCode}
            onChange={(e) => setForm((f) => ({ ...f, roleCode: e.target.value }))}
          >
            {staffRoles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
      </AdminFormModal>
    </>
  );
}
