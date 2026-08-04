"use client";

import { FormEvent, useState } from "react";
import {
  AdminAlert,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../components/admin/admin-ui";
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

export default function AdminInventoryPage() {
  const { data, error, loading, reload } = useAdminQuery<InventoryData>("/api/admin/inventory");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    productVariantId: "",
    type: "manual_adjustment",
    quantity: "1",
    note: ""
  });

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
    setForm((f) => ({ ...f, quantity: "1", note: "" }));
    await reload();
  };

  return (
    <>
      <AdminPageHeader
        title="Inventory"
        description="Monitor variant stock and post movements."
      />

      <AdminPanel title="Stock adjustment">
        <form className="admin-form-grid" onSubmit={onSubmit}>
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
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
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
          {formError && <AdminAlert>{formError}</AdminAlert>}
          <div className="admin-span-2">
            <button className="btn" type="submit" disabled={saving || !(data?.stock || []).length}>
              {saving ? "Posting…" : "Post movement"}
            </button>
          </div>
        </form>
      </AdminPanel>

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
                  <th>Qty</th>
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
                    <td>{row.variant_name || "—"}</td>
                    <td>
                      <b className={row.stock_quantity <= 5 ? "admin-warn-text" : ""}>
                        {row.stock_quantity}
                      </b>
                    </td>
                    <td>{row.product_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      <AdminPanel title="Recent movements">
        {!(data?.movements || []).length ? (
          <AdminEmpty title="No movements yet" />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Variant</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {(data?.movements || []).map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.created_at)}</td>
                    <td>{row.type}</td>
                    <td>{row.quantity}</td>
                    <td className="muted">{row.product_variant_id.slice(0, 8)}…</td>
                    <td>{row.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
    </>
  );
}
