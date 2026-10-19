"use client";

import { FormEvent, useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../../components/admin/admin-ui";
import { AdminPagination, DEFAULT_PAGE_SIZE } from "../../../../components/admin/admin-pagination";
import { AdminFormModal } from "../../../../components/admin/admin-form-modal";
import { adminFetch, formatMoney } from "../../../../lib/admin-api";
import { useAdminQuery } from "../../../../hooks/use-admin-query";
import { OPS_PLATFORM_NAME } from "../../../../lib/platform";

type CashAccount = {
  id: string;
  code: string;
  name: string;
  kind: string;
  opening_balance: string | number;
  current_balance?: number;
  total_in?: number;
  total_out?: number;
  is_default: boolean;
  is_active: boolean;
};

export default function FinanceCashBankPage() {
  const { data, error, loading, reload } = useAdminQuery<CashAccount[]>(
    "/api/admin/finance/cash-accounts"
  );
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    kind: "cash" as "cash" | "bank",
    opening_balance: "0",
    notes: ""
  });
  const [page, setPage] = useState(0);

  const rows = data || [];
  const pagedRows = useMemo(() => {
    const start = page * DEFAULT_PAGE_SIZE;
    return rows.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [rows, page]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    const result = await adminFetch("/api/admin/finance/cash-accounts", {
      method: "POST",
      json: {
        ...form,
        opening_balance: Number(form.opening_balance || 0)
      }
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setOpen(false);
    await reload();
  };

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Cash &amp; Bank"
        description="Cash in hand and bank/UPI wallets. Set opening balance once; balances update from synced sales, expenses and supplier payments."
        actions={
          <button
            type="button"
            className="admin-icon-tip admin-action-btn--primary"
            onClick={() => setOpen(true)}
            data-tooltip="Add wallet"
            aria-label="Add wallet"
          >
            <Wallet size={17} strokeWidth={2.2} />
            <span>Add wallet</span>
          </button>
        }
      />
      {error ? <AdminAlert>{error}</AdminAlert> : null}
      <AdminPanel title="Wallets">
        {loading ? <AdminLoading /> : null}
        {!loading && !rows.length ? (
          <AdminEmpty title="No wallets" body="Defaults are seeded on first finance sync." />
        ) : null}
        {rows.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Kind</th>
                  <th>Opening</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>Balance</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.code}</b>
                    </td>
                    <td>{row.name}</td>
                    <td>{row.kind}</td>
                    <td>{formatMoney(row.opening_balance)}</td>
                    <td>{formatMoney(row.total_in || 0)}</td>
                    <td>{formatMoney(row.total_out || 0)}</td>
                    <td>
                      <b>{formatMoney(row.current_balance || 0)}</b>
                    </td>
                    <td>
                      {row.is_default ? <AdminBadge tone="info">default</AdminBadge> : null}{" "}
                      <AdminBadge tone={row.is_active ? "success" : "neutral"}>
                        {row.is_active ? "active" : "inactive"}
                      </AdminBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <AdminPagination
              page={page}
              total={rows.length}
              onPageChange={setPage}
              noun="wallets"
            />
          </div>
        ) : null}
      </AdminPanel>

      <AdminFormModal
        open={open}
        title="New cash / bank account"
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
          <span>Kind</span>
          <select
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as "cash" | "bank" }))}
          >
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
          </select>
        </label>
        <label>
          <span>Opening balance</span>
          <input
            type="number"
            step="0.01"
            value={form.opening_balance}
            onChange={(e) => setForm((f) => ({ ...f, opening_balance: e.target.value }))}
          />
        </label>
      </AdminFormModal>
    </div>
  );
}
