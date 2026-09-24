"use client";

import { FormEvent, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  statusTone
} from "./admin-ui";
import { AdminFormModal } from "./admin-form-modal";
import { adminFetch, formatDate, formatMoney } from "../../lib/admin-api";
import { useAdminQuery } from "../../hooks/use-admin-query";
import { CATEGORY_LABELS } from "../../lib/finance-labels";
import type { FinanceDirection } from "../../lib/finance-labels";
import { OPS_PLATFORM_NAME } from "../../lib/platform";

type FinanceEntry = {
  id: string;
  entry_no: string;
  direction: string;
  category: string;
  amount: string | number;
  payment_method: string;
  status: string;
  entry_date: string;
  counterparty_name: string | null;
  reference_no: string | null;
  notes: string | null;
  order_number?: string | null;
};

const IN_CATEGORIES = ["sales", "other_income", "transfer", "other"];
const OUT_CATEGORIES = [
  "purchase",
  "expense",
  "salary",
  "rent",
  "utilities",
  "logistics",
  "packaging",
  "marketing",
  "maintenance",
  "tax",
  "refund",
  "transfer",
  "other"
];

const METHODS = ["cash", "upi", "card", "bank", "cheque", "razorpay", "other"];
const STATUSES = ["pending", "cleared", "cancelled"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function blankForm(direction: FinanceDirection, categoryFilter?: string[]) {
  const defaultCategory =
    categoryFilter?.[0] || (direction === "in" ? "sales" : "expense");
  return {
    category: defaultCategory,
    amount: "",
    payment_method: "cash",
    status: "cleared",
    entry_date: todayIso(),
    counterparty_name: "",
    reference_no: "",
    notes: ""
  };
}

export function FinancePaymentsPanel({
  direction,
  title,
  description,
  categoryFilter
}: {
  direction: FinanceDirection;
  title: string;
  description: string;
  /** If set, only these categories are listed / selectable */
  categoryFilter?: string[];
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(() => blankForm(direction, categoryFilter));

  const path = useMemo(() => {
    const params = new URLSearchParams({ direction, limit: "200" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status !== "all") params.set("status", status);
    if (submittedQ) params.set("q", submittedQ);
    return `/api/admin/finance/entries?${params.toString()}`;
  }, [direction, from, to, status, submittedQ]);

  const { data, error, loading, reload } = useAdminQuery<FinanceEntry[]>(path);
  const categories = (direction === "in" ? IN_CATEGORIES : OUT_CATEGORIES).filter((c) =>
    categoryFilter?.length ? categoryFilter.includes(c) : true
  );
  const rows = (data || []).filter((row) =>
    categoryFilter?.length ? categoryFilter.includes(row.category) : true
  );

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm(direction, categoryFilter));
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (row: FinanceEntry) => {
    setEditing(row);
    setForm({
      category: row.category,
      amount: String(row.amount),
      payment_method: row.payment_method,
      status: row.status,
      entry_date: String(row.entry_date).slice(0, 10),
      counterparty_name: row.counterparty_name || "",
      reference_no: row.reference_no || "",
      notes: row.notes || ""
    });
    setFormError("");
    setModalOpen(true);
  };

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setMessage("");
    const payload = {
      category: form.category,
      amount: Number(form.amount),
      payment_method: form.payment_method,
      status: form.status,
      entry_date: form.entry_date,
      counterparty_name: form.counterparty_name || null,
      reference_no: form.reference_no || null,
      notes: form.notes || null
    };

    const result = editing
      ? await adminFetch(`/api/admin/finance/entries/${editing.id}`, {
          method: "PATCH",
          json: payload
        })
      : await adminFetch("/api/admin/finance/entries", {
          method: "POST",
          json: { ...payload, direction }
        });

    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setModalOpen(false);
    setMessage(editing ? "Payment updated." : "Payment recorded.");
    await reload();
  };

  const syncOrders = async () => {
    setSyncing(true);
    setMessage("");
    const result = await adminFetch<{ inserted?: number }>("/api/admin/finance/sync", {
      method: "POST"
    });
    setSyncing(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setMessage(`Synced ${result.data?.inserted ?? 0} paid order receipt(s).`);
    await reload();
  };

  return (
    <>
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title={title}
        description={description}
        actions={
          <>
            {direction === "in" ? (
              <button
                type="button"
                className="btn ghost"
                disabled={syncing}
                onClick={() => void syncOrders()}
              >
                <RefreshCw size={15} />
                {syncing ? "Syncing…" : "Sync paid orders"}
              </button>
            ) : null}
            <button type="button" className="btn" onClick={openCreate}>
              <Plus size={15} />
              New entry
            </button>
          </>
        }
      />

      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedQ(q.trim());
        }}
      >
        <label>
          <span>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-grow">
          <span>Search</span>
          <input
            placeholder="Entry no, party, reference…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button className="btn" type="submit">
          Apply
        </button>
      </form>

      {message ? <AdminAlert tone="ok">{message}</AdminAlert> : null}
      {error ? <AdminAlert>{error}</AdminAlert> : null}

      <AdminPanel title={direction === "in" ? "Incoming register" : "Outgoing register"}>
        {loading ? <AdminLoading /> : null}
        {!loading && !rows.length ? (
          <AdminEmpty
            title="No payments in this range"
            body={
              direction === "in"
                ? "Sync paid orders or add a receipt manually."
                : "Record supplier, expense, salary or refund payments."
            }
          />
        ) : null}
        {rows.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Entry</th>
                  <th>Party</th>
                  <th>Category</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.entry_date)}</td>
                    <td>
                      <b>{row.entry_no}</b>
                      {row.order_number || row.reference_no ? (
                        <div className="muted admin-sub">
                          {row.order_number || row.reference_no}
                        </div>
                      ) : null}
                    </td>
                    <td>{row.counterparty_name || "—"}</td>
                    <td>{CATEGORY_LABELS[row.category] || row.category}</td>
                    <td>{row.payment_method}</td>
                    <td>
                      <AdminBadge tone={statusTone(row.status)}>{row.status}</AdminBadge>
                    </td>
                    <td>
                      <b>{formatMoney(row.amount)}</b>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-action-btn"
                        data-tooltip="Update payment"
                        aria-label={`Edit ${row.entry_no}`}
                        onClick={() => openEdit(row)}
                      >
                        <Pencil size={14} />
                        <span>Edit</span>
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
        open={modalOpen}
        title={editing ? "Update payment" : direction === "in" ? "Incoming payment" : "Outgoing payment"}
        eyebrow="Finance"
        submitLabel={editing ? "Save" : "Record"}
        saving={saving}
        error={formError}
        onClose={() => setModalOpen(false)}
        onSubmit={onSave}
      >
        <label>
          <span>Category</span>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c] || c}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Amount (₹)</span>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
        </label>
        <label>
          <span>Method</span>
          <select
            value={form.payment_method}
            onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Date</span>
          <input
            type="date"
            required
            value={form.entry_date}
            onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
          />
        </label>
        <label>
          <span>Counterparty</span>
          <input
            value={form.counterparty_name}
            onChange={(e) => setForm((f) => ({ ...f, counterparty_name: e.target.value }))}
            placeholder="Customer / supplier / staff"
          />
        </label>
        <label>
          <span>Reference</span>
          <input
            value={form.reference_no}
            onChange={(e) => setForm((f) => ({ ...f, reference_no: e.target.value }))}
            placeholder="UTR / cheque / invoice no"
          />
        </label>
        <label className="admin-span-2">
          <span>Notes</span>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </label>
      </AdminFormModal>
    </>
  );
}
