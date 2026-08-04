"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  slugify,
  statusTone
} from "../../../components/admin/admin-ui";
import { adminFetch, formatDate, formatMoney } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type Product = {
  id: string;
  name: string;
  slug: string;
  price: string;
  compare_at_price: string | null;
  status: string;
  stock_quantity: number;
  category_id: string;
  category_name?: string | null;
  created_at: string;
};

type Category = { id: string; name: string; slug: string };

export default function AdminProductsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    name: "",
    slug: "",
    category_id: "",
    price: "",
    compare_at_price: "",
    stock_quantity: "0",
    status: "draft",
    description: ""
  });

  const productsPath = useMemo(
    () => `/api/admin/products${statusFilter ? `?status=${statusFilter}` : ""}`,
    [statusFilter]
  );
  const { data: products, error, loading, reload } = useAdminQuery<Product[]>(productsPath);
  const { data: categories } = useAdminQuery<Category[]>("/api/admin/categories");

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const result = await adminFetch("/api/admin/products", {
      method: "POST",
      json: {
        name: form.name,
        slug: form.slug || slugify(form.name),
        category_id: form.category_id,
        price: Number(form.price),
        compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
        stock_quantity: Number(form.stock_quantity || 0),
        status: form.status,
        description: form.description
      }
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setShowForm(false);
    setForm({
      name: "",
      slug: "",
      category_id: "",
      price: "",
      compare_at_price: "",
      stock_quantity: "0",
      status: "draft",
      description: ""
    });
    await reload();
  };

  const updateStatus = async (id: string, nextStatus: string) => {
    const result = await adminFetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      json: { status: nextStatus }
    });
    if (!result.error) await reload();
  };

  return (
    <>
      <AdminPageHeader
        title="Products"
        description="Create, publish and archive catalogue items."
        actions={
          <button type="button" className="btn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close form" : "+ New product"}
          </button>
        }
      />

      <div className="admin-toolbar">
        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      {showForm && (
        <AdminPanel title="Create product">
          <form className="admin-form-grid" onSubmit={onCreate}>
            <label>
              <span>Name</span>
              <input
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: f.slug || slugify(e.target.value)
                  }))
                }
              />
            </label>
            <label>
              <span>Slug</span>
              <input
                required
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
              />
            </label>
            <label>
              <span>Category</span>
              <select
                required
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
              >
                <option value="">Select category</option>
                {(categories || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Price (₹)</span>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </label>
            <label>
              <span>Compare at</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.compare_at_price}
                onChange={(e) => setForm((f) => ({ ...f, compare_at_price: e.target.value }))}
              />
            </label>
            <label>
              <span>Stock</span>
              <input
                type="number"
                min="0"
                value={form.stock_quantity}
                onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </label>
            <label className="admin-span-2">
              <span>Description</span>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            {formError && <AdminAlert>{formError}</AdminAlert>}
            <div className="admin-span-2">
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Create product"}
              </button>
            </div>
          </form>
        </AdminPanel>
      )}

      <AdminPanel title="Catalogue">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !error && !(products || []).length && (
          <AdminEmpty title="No products" body="Create your first product to populate the storefront." />
        )}
        {(products || []).length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(products || []).map((product) => (
                  <tr key={product.id}>
                    <td>
                      <b>{product.name}</b>
                      <div className="muted admin-sub">{product.slug}</div>
                    </td>
                    <td>{product.category_name || "—"}</td>
                    <td>
                      {formatMoney(product.price)}
                      {product.compare_at_price ? (
                        <div className="muted admin-sub strike">{formatMoney(product.compare_at_price)}</div>
                      ) : null}
                    </td>
                    <td>{product.stock_quantity}</td>
                    <td>
                      <AdminBadge tone={statusTone(product.status)}>{product.status}</AdminBadge>
                    </td>
                    <td>{formatDate(product.created_at)}</td>
                    <td>
                      <div className="admin-row-actions">
                        {product.status !== "active" && (
                          <button type="button" onClick={() => void updateStatus(product.id, "active")}>
                            Publish
                          </button>
                        )}
                        {product.status === "active" && (
                          <button type="button" onClick={() => void updateStatus(product.id, "draft")}>
                            Unpublish
                          </button>
                        )}
                        {product.status !== "archived" && (
                          <button type="button" onClick={() => void updateStatus(product.id, "archived")}>
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
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
