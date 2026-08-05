"use client";

import { FormEvent, useState } from "react";
import {
  AdminAlert,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../components/admin/admin-ui";
import { AdminFormModal } from "../../../components/admin/admin-form-modal";
import { adminFetch, formatDate } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type InventoryData = {
  movements: Array<{
    id: string;
    product_variant_id: string;
    type: string;
    quantity: number;
    note: string | null;
    created_at: string;
  }>;
  stock: Array<{
    variant_id: string;
    sku: string | null;
    variant_name: string | null;
    attributes: Record<string, unknown> | null;
    stock_quantity: number;
    product_id: string;
    product_name: string;
    product_status: string;
  }>;
};

const blankForm = () => ({
  productVariantId: "",
  type: "manual_adjustment",
  quantity: "1",
  note: ""
});

export default function AdminInventoryPage() {
  const { data, error, loading, reload } = useAdminQuery<InventoryData>("/api/admin/inventory");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(blankForm);

  const openCreate = () => {
    setForm(blankForm());
    setFormError("");
    setModalOpen(true);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const result = await adminFetch("/api/admin/inventory", {
      method: "POST",
      json: {
        productVariantId: form.productVariantId,
        type: form.type,
        quantity: Number(form.quantity),
        note: form.note || undefined
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

  return (
    <>
      <AdminPageHeader
        eyebrow=""
        title="Inventory"
        actions={
          <button
            type="button"
            className="btn"
            onClick={openCreate}
            disabled={!(data?.stock || []).length}
          >
            + Stock adjustment
          </button>
        }
      />

      <AdminPanel title="Current stock">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !(data?.stock || []).length && (
          <AdminEmpty
            title="No variants yet"
            body="Add product variants before tracking inventory movements."
          />
        )}
        {(data?.stock || []).length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Variant</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.stock || []).map((row) => (
                  <tr key={row.variant_id}>
                    <td>
                      <b>{row.product_name}</b>
                    </td>
                    <td>{row.sku || "—"}</td>
                    <td>{row.variant_name || "Default"}</td>
                    <td>{row.stock_quantity}</td>
                    <td>{row.product_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      <AdminPanel title="Recent movements">
        {loading && <AdminLoading />}
        {!loading && !(data?.movements || []).length && (
          <AdminEmpty title="No movements yet" body="Post a stock adjustment to begin the ledger." />
        )}
        {(data?.movements || []).length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Note</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {(data?.movements || []).map((movement) => (
                  <tr key={movement.id}>
                    <td>{movement.type}</td>
                    <td>{movement.quantity}</td>
                    <td>{movement.note || "—"}</td>
                    <td>{formatDate(movement.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      <AdminFormModal
        open={modalOpen}
        title="Stock adjustment"
        eyebrow="Inventory"
        submitLabel="Post movement"
        savingLabel="Posting…"
        saving={saving}
        error={formError}
        onClose={() => setModalOpen(false)}
        onSubmit={onSubmit}
      >
        <label className="admin-span-2">
          <span>Variant</span>
          <select
            required
            value={form.productVariantId}
            onChange={(e) => setForm((f) => ({ ...f, productVariantId: e.target.value }))}
          >
            <option value="">Select variant</option>
            {(data?.stock || []).map((row) => (
              <option key={row.variant_id} value={row.variant_id}>
                {row.product_name} · {row.sku || "no-sku"} · qty {row.stock_quantity}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Type</span>
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            <option value="opening_stock">Opening stock</option>
            <option value="manual_adjustment">Manual adjustment</option>
            <option value="return">Return</option>
            <option value="sale">Sale</option>
          </select>
        </label>
        <label>
          <span>Quantity</span>
          <input
            required
            type="number"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
          />
        </label>
        <label className="admin-span-2">
          <span>Note</span>
          <input
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="Optional reason"
          />
        </label>
      </AdminFormModal>
    </>
  );
}
