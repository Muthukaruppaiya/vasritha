"use client";

import { FormEvent, useState } from "react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../../components/admin/admin-ui";
import { AdminFormModal } from "../../../../components/admin/admin-form-modal";
import { adminFetch } from "../../../../lib/admin-api";
import { useAdminQuery } from "../../../../hooks/use-admin-query";
import { OPS_PLATFORM_NAME } from "../../../../lib/platform";

type Account = {
  id: string;
  code: string;
  name: string;
  account_type: string;
  is_system: boolean;
  is_active: boolean;
  notes: string | null;
};

export default function FinanceAccountsPage() {
  const { data, error, loading, reload } = useAdminQuery<Account[]>("/api/admin/finance/accounts");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    account_type: "expense",
    notes: ""
  });

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    const result = await adminFetch("/api/admin/finance/accounts", {
      method: "POST",
      json: form
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setOpen(false);
    await reload();
  };

  const toggleActive = async (row: Account) => {
    await adminFetch(`/api/admin/finance/accounts/${row.id}`, {
      method: "PATCH",
      json: { is_active: !row.is_active }
    });
    await reload();
  };

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Chart of accounts"
        description="Asset, liability, equity, income and expense accounts. System accounts can be deactivated but not deleted."
        actions={
          <button type="button" className="btn" onClick={() => setOpen(true)}>
            New account
          </button>
        }
      />
      {error ? <AdminAlert>{error}</AdminAlert> : null}
      <AdminPanel title="Accounts">
        {loading ? <AdminLoading /> : null}
        {!loading && !(data || []).length ? <AdminEmpty title="No accounts" body="Seed will create defaults on first sync." /> : null}
        {(data || []).length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.code}</b>
                    </td>
                    <td>{row.name}</td>
                    <td>{row.account_type}</td>
                    <td>
                      <AdminBadge tone={row.is_active ? "success" : "neutral"}>
                        {row.is_active ? "active" : "inactive"}
                      </AdminBadge>
                    </td>
                    <td>
                      <button type="button" className="admin-action-btn" onClick={() => void toggleActive(row)}>
                        {row.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </AdminPanel>

      <AdminFormModal
        open={open}
        title="New account"
        eyebrow="Finance"
        submitLabel="Create"
        saving={saving}
        error={formError}
        onClose={() => setOpen(false)}
        onSubmit={onSave}
      >
        <label>
          <span>Code</span>
          <input required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
        </label>
        <label>
          <span>Name</span>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </label>
        <label>
          <span>Type</span>
          <select
            value={form.account_type}
            onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value }))}
          >
            {["asset", "liability", "equity", "income", "expense"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-span-2">
          <span>Notes</span>
          <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </label>
      </AdminFormModal>
    </div>
  );
}
