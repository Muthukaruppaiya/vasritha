"use client";

import { FormEvent, useState } from "react";
import {
  AdminAlert,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  slugify
} from "../../../components/admin/admin-ui";
import { adminFetch, formatDate } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  created_at: string;
};

export default function AdminCategoriesPage() {
  const { data, error, loading, reload } = useAdminQuery<Category[]>("/api/admin/categories");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    sort_order: "0"
  });

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const result = await adminFetch("/api/admin/categories", {
      method: "POST",
      json: {
        name: form.name,
        slug: form.slug || slugify(form.name),
        description: form.description || null,
        sort_order: Number(form.sort_order || 0)
      }
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setShowForm(false);
    setForm({ name: "", slug: "", description: "", sort_order: "0" });
    await reload();
  };

  return (
    <>
      <AdminPageHeader
        title="Categories"
        description="Organise departments that power storefront browsing."
        actions={
          <button type="button" className="btn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close form" : "+ New category"}
          </button>
        }
      />

      {showForm && (
        <AdminPanel title="Create category">
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
              <span>Sort order</span>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
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
                {saving ? "Saving…" : "Create category"}
              </button>
            </div>
          </form>
        </AdminPanel>
      )}

      <AdminPanel title="All categories">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !(data || []).length && (
          <AdminEmpty title="No categories" body="Add Sarees, Jewelry and other departments first." />
        )}
        {(data || []).length > 0 && (
          <div className="admin-card-grid">
            {(data || []).map((category) => (
              <article key={category.id} className="admin-soft-card">
                <div className="eyebrow">#{category.sort_order}</div>
                <h3>{category.name}</h3>
                <p className="muted">{category.slug}</p>
                <p>{category.description || "No description yet."}</p>
                <p className="muted admin-sub">Added {formatDate(category.created_at)}</p>
              </article>
            ))}
          </div>
        )}
      </AdminPanel>
    </>
  );
}
