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
import { AdminFormModal } from "../../../components/admin/admin-form-modal";
import { adminFetch, adminUpload, formatDate } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_path: string | null;
  sort_order: number;
  created_at: string;
};

const blankForm = () => ({
  name: "",
  slug: "",
  description: "",
  sort_order: "0"
});

export default function AdminCategoriesPage() {
  const { data, error, loading, reload } = useAdminQuery<Category[]>("/api/admin/categories");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState(blankForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const isEdit = Boolean(editing);

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setImageFile(null);
    setImagePreview("");
    setFormError("");
    setActionError("");
    setModalOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      sort_order: String(category.sort_order ?? 0)
    });
    setImageFile(null);
    setImagePreview(category.image_path || "");
    setFormError("");
    setActionError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(blankForm());
    setImageFile(null);
    setImagePreview("");
    setFormError("");
  };

  const onPickImage = (fileList: FileList | null) => {
    const file = fileList?.[0] || null;
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
      return;
    }
    setImagePreview(editing?.image_path || "");
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isEdit && !imageFile) {
      setFormError("Background image is required for the category banner.");
      return;
    }

    setSaving(true);
    setFormError("");

    const payload = {
      name: form.name,
      slug: form.slug || slugify(form.name),
      description: form.description || null,
      sort_order: Number(form.sort_order || 0)
    };

    if (isEdit && editing) {
      const result = await adminFetch<Category>(`/api/admin/categories/${editing.id}`, {
        method: "PATCH",
        json: payload
      });

      if (result.error || !result.data?.id) {
        setSaving(false);
        setFormError(result.error || "Could not update category");
        return;
      }

      if (imageFile) {
        const body = new FormData();
        body.append("file", imageFile);
        const upload = await adminUpload(`/api/admin/categories/${editing.id}/image`, body);
        if (upload.error) {
          setSaving(false);
          setFormError(`Category updated, but image upload failed: ${upload.error}`);
          await reload();
          return;
        }
      }

      setSaving(false);
      closeModal();
      await reload();
      return;
    }

    const result = await adminFetch<Category>("/api/admin/categories", {
      method: "POST",
      json: payload
    });

    if (result.error || !result.data?.id) {
      setSaving(false);
      setFormError(result.error || "Could not create category");
      return;
    }

    const body = new FormData();
    body.append("file", imageFile as File);
    const upload = await adminUpload(`/api/admin/categories/${result.data.id}/image`, body);
    setSaving(false);

    if (upload.error) {
      setFormError(`Category created, but image upload failed: ${upload.error}`);
      await reload();
      return;
    }

    closeModal();
    await reload();
  };

  const onDelete = async (category: Category) => {
    const ok = window.confirm(
      `Delete “${category.name}”? This cannot be undone.`
    );
    if (!ok) return;

    setDeletingId(category.id);
    setActionError("");
    const result = await adminFetch(`/api/admin/categories/${category.id}`, {
      method: "DELETE"
    });
    setDeletingId(null);

    if (result.error) {
      setActionError(result.error);
      return;
    }
    await reload();
  };

  const onReplaceImage = async (categoryId: string, fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;

    setUploadingId(categoryId);
    setActionError("");
    const body = new FormData();
    body.append("file", file);
    const upload = await adminUpload(`/api/admin/categories/${categoryId}/image`, body);
    setUploadingId(null);
    if (upload.error) {
      setActionError(upload.error);
      return;
    }
    await reload();
  };

  return (
    <>
      <AdminPageHeader
        eyebrow=""
        title="Categories"
        actions={
          <button type="button" className="btn" onClick={openCreate}>
            + New category
          </button>
        }
      />

      <AdminPanel title="All categories">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {actionError && <AdminAlert>{actionError}</AdminAlert>}
        {!loading && !(data || []).length && (
          <AdminEmpty title="No categories" body="Add Sarees, Jewelry and other departments first." />
        )}
        {(data || []).length > 0 && (
          <div className="admin-card-grid">
            {(data || []).map((category) => (
              <article key={category.id} className="admin-soft-card">
                <div className="admin-soft-card-media">
                  {category.image_path ? (
                    <img src={category.image_path} alt="" />
                  ) : (
                    <span className="muted">No background image</span>
                  )}
                </div>
                <div className="eyebrow">#{category.sort_order}</div>
                <h3>{category.name}</h3>
                <p className="muted">{category.slug}</p>
                <p>{category.description || "No description yet."}</p>
                <p className="muted admin-sub">Added {formatDate(category.created_at)}</p>
                <div className="admin-row-actions">
                  <button type="button" onClick={() => openEdit(category)}>
                    Edit
                  </button>
                  <label className="admin-file-btn admin-file-btn--inline">
                    <span>{uploadingId === category.id ? "Uploading…" : "Change background"}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={uploadingId === category.id}
                      onChange={(e) => {
                        void onReplaceImage(category.id, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-danger-btn"
                    disabled={deletingId === category.id}
                    onClick={() => void onDelete(category)}
                  >
                    {deletingId === category.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </AdminPanel>

      <AdminFormModal
        open={modalOpen}
        title={isEdit ? "Edit category" : "Add category"}
        eyebrow="Catalogue"
        submitLabel={isEdit ? "Save changes" : "Create category"}
        savingLabel={isEdit ? "Saving…" : "Creating…"}
        saving={saving}
        error={formError}
        onClose={closeModal}
        onSubmit={onSubmit}
      >
        <label>
          <span>Name</span>
          <input
            required
            value={form.name}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                name: e.target.value,
                slug: isEdit ? f.slug : slugify(e.target.value)
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
          <span>Background image{isEdit ? " (optional)" : ""}</span>
          <input
            required={!isEdit}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => onPickImage(e.target.files)}
          />
          <span className="muted admin-sub">
            {isEdit
              ? "Leave empty to keep the current background."
              : "Used on home category banners and category pages."}
          </span>
          {imagePreview ? (
            <img className="admin-upload-preview" src={imagePreview} alt="" />
          ) : null}
        </label>
        <label className="admin-span-2">
          <span>Description</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>
      </AdminFormModal>
    </>
  );
}
