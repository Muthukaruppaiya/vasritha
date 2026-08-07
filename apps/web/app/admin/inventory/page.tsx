"use client";

import { FormEvent, useMemo, useState } from "react";
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

type InwardLine = { productVariantId: string; quantity: string };

const blankAdjust = () => ({
  productVariantId: "",
  type: "manual_adjustment",
  quantity: "1",
  note: ""
});

const blankInward = () => ({
  supplier: "",
  billNo: "",
  note: "",
  lines: [{ productVariantId: "", quantity: "1" }] as InwardLine[]
});

export default function AdminInventoryPage() {
  const { data, error, loading, reload } = useAdminQuery<InventoryData>("/api/admin/inventory");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [inwardOpen, setInwardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [adjust, setAdjust] = useState(blankAdjust);
  const [inward, setInward] = useState(blankInward);

  const stockOptions = useMemo(() => data?.stock || [], [data?.stock]);

  const openAdjust = () => {
    setAdjust(blankAdjust());
    setFormError("");
    setAdjustOpen(true);
  };

  const openInward = () => {
    setInward(blankInward());
    setFormError("");
    setInwardOpen(true);
  };

  const onAdjustSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const result = await adminFetch("/api/admin/inventory", {
      method: "POST",
      json: {
        productVariantId: adjust.productVariantId,
        type: adjust.type,
        quantity: Number(adjust.quantity),
        note: adjust.note || undefined
      }
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setAdjustOpen(false);
    setAdjust(blankAdjust());
    await reload();
  };

  const onInwardSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const result = await adminFetch("/api/admin/inventory/inward", {
      method: "POST",
      json: {
        supplier: inward.supplier || undefined,
        billNo: inward.billNo || undefined,
        note: inward.note || undefined,
        lines: inward.lines.map((line) => ({
          productVariantId: line.productVariantId,
          quantity: Number(line.quantity)
        }))
      }
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setInwardOpen(false);
    setInward(blankInward());
    await reload();
  };

  return (
    <>
      <AdminPageHeader
        eyebrow=""
        title="Inventory"
        actions={
          <>
            <button
              type="button"
              className="btn"
              onClick={openInward}
              disabled={!stockOptions.length}
            >
              + Inward stock (GRN)
            </button>
            <button
              type="button"
              className="btn admin-ghost-btn"
              onClick={openAdjust}
              disabled={!stockOptions.length}
            >
              Stock adjustment
            </button>
          </>
        }
      />

      <AdminPanel title="Current stock">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !stockOptions.length && (
          <AdminEmpty
            title="No variants yet"
            body="Add product variants before tracking inventory movements."
          />
        )}
        {stockOptions.length > 0 && (
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
                {stockOptions.map((row) => (
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
          <AdminEmpty title="No movements yet" body="Post inward stock or an adjustment to begin the ledger." />
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
        open={inwardOpen}
        title="Inward stock (GRN)"
        eyebrow="Goods received"
        submitLabel="Post inward"
        savingLabel="Posting…"
        saving={saving}
        error={formError}
        onClose={() => setInwardOpen(false)}
        onSubmit={onInwardSubmit}
      >
        <label>
          <span>Supplier</span>
          <input
            value={inward.supplier}
            onChange={(e) => setInward((f) => ({ ...f, supplier: e.target.value }))}
            placeholder="Optional"
          />
        </label>
        <label>
          <span>Bill / invoice no.</span>
          <input
            value={inward.billNo}
            onChange={(e) => setInward((f) => ({ ...f, billNo: e.target.value }))}
            placeholder="Optional"
          />
        </label>
        <label className="admin-span-2">
          <span>Note</span>
          <input
            value={inward.note}
            onChange={(e) => setInward((f) => ({ ...f, note: e.target.value }))}
            placeholder="Optional remark"
          />
        </label>

        <div className="admin-span-2" style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: "0.85rem" }}>Lines</strong>
            <button
              type="button"
              className="btn admin-ghost-btn"
              onClick={() =>
                setInward((f) => ({
                  ...f,
                  lines: [...f.lines, { productVariantId: "", quantity: "1" }]
                }))
              }
            >
              + Add line
            </button>
          </div>
          {inward.lines.map((line, index) => (
            <div
              key={`line-${index}`}
              style={{ display: "grid", gridTemplateColumns: "1fr 110px auto", gap: 8 }}
            >
              <select
                required
                value={line.productVariantId}
                onChange={(e) =>
                  setInward((f) => {
                    const lines = [...f.lines];
                    lines[index] = { ...lines[index], productVariantId: e.target.value };
                    return { ...f, lines };
                  })
                }
              >
                <option value="">Select SKU / variant</option>
                {stockOptions.map((row) => (
                  <option key={row.variant_id} value={row.variant_id}>
                    {row.product_name} · {row.sku || "no-sku"} · on hand {row.stock_quantity}
                  </option>
                ))}
              </select>
              <input
                required
                type="number"
                min={1}
                step={1}
                value={line.quantity}
                onChange={(e) =>
                  setInward((f) => {
                    const lines = [...f.lines];
                    lines[index] = { ...lines[index], quantity: e.target.value };
                    return { ...f, lines };
                  })
                }
                aria-label="Inward quantity"
              />
              <button
                type="button"
                className="btn admin-ghost-btn"
                disabled={inward.lines.length <= 1}
                onClick={() =>
                  setInward((f) => ({
                    ...f,
                    lines: f.lines.filter((_, i) => i !== index)
                  }))
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </AdminFormModal>

      <AdminFormModal
        open={adjustOpen}
        title="Stock adjustment"
        eyebrow="Inventory"
        submitLabel="Post movement"
        savingLabel="Posting…"
        saving={saving}
        error={formError}
        onClose={() => setAdjustOpen(false)}
        onSubmit={onAdjustSubmit}
      >
        <label className="admin-span-2">
          <span>Variant</span>
          <select
            required
            value={adjust.productVariantId}
            onChange={(e) => setAdjust((f) => ({ ...f, productVariantId: e.target.value }))}
          >
            <option value="">Select variant</option>
            {stockOptions.map((row) => (
              <option key={row.variant_id} value={row.variant_id}>
                {row.product_name} · {row.sku || "no-sku"} · qty {row.stock_quantity}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Type</span>
          <select value={adjust.type} onChange={(e) => setAdjust((f) => ({ ...f, type: e.target.value }))}>
            <option value="opening_stock">Opening stock</option>
            <option value="manual_adjustment">Manual adjustment</option>
            <option value="purchase">Purchase (single)</option>
            <option value="return">Return</option>
            <option value="sale">Sale</option>
          </select>
        </label>
        <label>
          <span>Quantity</span>
          <input
            required
            type="number"
            value={adjust.quantity}
            onChange={(e) => setAdjust((f) => ({ ...f, quantity: e.target.value }))}
          />
        </label>
        <label className="admin-span-2">
          <span>Note</span>
          <input
            value={adjust.note}
            onChange={(e) => setAdjust((f) => ({ ...f, note: e.target.value }))}
            placeholder="Optional reason"
          />
        </label>
      </AdminFormModal>
    </>
  );
}
