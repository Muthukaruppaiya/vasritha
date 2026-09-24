"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AdminAlert,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../../components/admin/admin-ui";
import { adminFetch } from "../../../../lib/admin-api";
import { useAdminQuery } from "../../../../hooks/use-admin-query";
import { OPS_PLATFORM_NAME } from "../../../../lib/platform";

type Settings = {
  fy_start_month: number;
  default_cash_account_id: string | null;
  default_bank_account_id: string | null;
  currency: string;
};

type CashAccount = { id: string; code: string; name: string; kind: string };

export default function FinanceSettingsPage() {
  const { data, error, loading, reload } = useAdminQuery<Settings>("/api/admin/finance/settings");
  const { data: wallets } = useAdminQuery<CashAccount[]>("/api/admin/finance/cash-accounts");
  const [form, setForm] = useState({
    fy_start_month: 4,
    default_cash_account_id: "",
    default_bank_account_id: "",
    currency: "INR"
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!data) return;
    setForm({
      fy_start_month: data.fy_start_month || 4,
      default_cash_account_id: data.default_cash_account_id || "",
      default_bank_account_id: data.default_bank_account_id || "",
      currency: data.currency || "INR"
    });
  }, [data]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setFormError("");
    const result = await adminFetch("/api/admin/finance/settings", {
      method: "PATCH",
      json: {
        fy_start_month: Number(form.fy_start_month),
        default_cash_account_id: form.default_cash_account_id || null,
        default_bank_account_id: form.default_bank_account_id || null,
        currency: form.currency
      }
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setMessage("Finance settings saved.");
    await reload();
  };

  const cashWallets = (wallets || []).filter((w) => w.kind === "cash");
  const bankWallets = (wallets || []).filter((w) => w.kind === "bank");

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Finance settings"
        description="Financial year and default cash/bank wallets. Tax rates stay in existing Tax / company settings."
      />
      {error ? <AdminAlert>{error}</AdminAlert> : null}
      {message ? <AdminAlert tone="ok">{message}</AdminAlert> : null}
      {formError ? <AdminAlert>{formError}</AdminAlert> : null}
      {loading ? <AdminLoading /> : null}

      <AdminPanel title="Defaults">
        <form className="admin-form-grid" onSubmit={(e) => void onSave(e)}>
          <label>
            <span>FY start month</span>
            <select
              value={form.fy_start_month}
              onChange={(e) => setForm((f) => ({ ...f, fy_start_month: Number(e.target.value) }))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m} {m === 4 ? "(India April)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Currency</span>
            <input
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            />
          </label>
          <label>
            <span>Default cash wallet</span>
            <select
              value={form.default_cash_account_id}
              onChange={(e) => setForm((f) => ({ ...f, default_cash_account_id: e.target.value }))}
            >
              <option value="">—</option>
              {cashWallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Default bank wallet</span>
            <select
              value={form.default_bank_account_id}
              onChange={(e) => setForm((f) => ({ ...f, default_bank_account_id: e.target.value }))}
            >
              <option value="">—</option>
              {bankWallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.name}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-span-2">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </form>
      </AdminPanel>
    </div>
  );
}
