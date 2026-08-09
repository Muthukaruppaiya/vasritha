"use client";

import { FormEvent, useMemo, useState } from "react";
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
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(blankForm);

  const path = useMemo(
    () => `/api/admin/users${submitted ? `?q=${encodeURIComponent(submitted)}` : ""}`,
    [submitted]
  );
  const { data, error, loading, reload } = useAdminQuery<AdminUser[]>(path);
  const { data: roles } = useAdminQuery<RoleOption[]>("/api/admin/roles");

  const staffRoles = (roles || []).filter((role) => role.code !== "customer");

  const openCreate = () => {
    setForm({
      ...blankForm(),
      roleCode: staffRoles[0]?.code || "manager"
    });
    setFormError("");
    setModalOpen(true);
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
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
    await reload();
  };

  const updateRole = async (userId: string, roleCode: string) => {
    const result = await adminFetch("/api/admin/users", {
      method: "PATCH",
      json: { userId, roleCode }
    });
    if (!result.error) await reload();
  };

  return (
    <>
      <AdminPageHeader
        eyebrow=""
        title="Users"
        actions={
          <button type="button" className="btn" onClick={openCreate}>
            + New user
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
                  <th>Change role</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((user) => {
                  const staffOnlyRoles = user.roles.filter((role) => role.code !== "customer");
                  const displayRoles = staffOnlyRoles.length
                    ? staffOnlyRoles
                    : [{ code: "none", name: "No role" }];
                  const currentRole = staffOnlyRoles[0]?.code || "";
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
                        <select
                          defaultValue={currentRole}
                          onChange={(e) => {
                            if (e.target.value) void updateRole(user.id, e.target.value);
                          }}
                        >
                          <option value="" disabled>
                            Select role
                          </option>
                          {staffRoles.map((role) => (
                            <option key={role.code} value={role.code}>
                              {role.name}
                            </option>
                          ))}
                        </select>
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
        title="Add user"
        eyebrow="Staff access"
        submitLabel="Create user"
        savingLabel="Creating…"
        saving={saving}
        error={formError}
        onClose={() => setModalOpen(false)}
        onSubmit={onCreate}
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
          <span>Password</span>
          <input
            required
            type="password"
            minLength={6}
            value={form.password}
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
