"use client";

import { FormEvent, useState } from "react";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  findPredefinedCategory,
  PREDEFINED_CATEGORIES
} from "../../../lib/i18n/predefined-categories";

type Subcategory = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_path: string | null;
  sort_order: number;
  created_at: string;
  name_i18n?: Record<string, string> | null;
  subcategories?: Subcategory[];
};

const TRANSLATION_LOCALES = [
  ["ta", "Tamil"],
  ["ml", "Malayalam"],
  ["kn", "Kannada"],
  ["hi", "Hindi"],
  ["pa", "Punjabi"],
  ["gu", "Gujarati"]
] as const;

const blankForm = () => ({
  template: "",
  name: "",
  slug: "",
  description: "",
  sort_order: "0",
  names: {
    ta: "",
    ml: "",
    kn: "",
    hi: "",
    pa: "",
    gu: ""
  }
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
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subParent, setSubParent] = useState<Category | null>(null);
  const [subEditing, setSubEditing] = useState<Subcategory | null>(null);
  const [subSaving, setSubSaving] = useState(false);
  const [subError, setSubError] = useState("");
  const [subForm, setSubForm] = useState({ name: "", slug: "", sort_order: "0" });
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);

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
      template: findPredefinedCategory(category.slug)?.slug || "custom",
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      sort_order: String(category.sort_order ?? 0),
      names: {
        ta: category.name_i18n?.ta || "",
        ml: category.name_i18n?.ml || "",
        kn: category.name_i18n?.kn || "",
        hi: category.name_i18n?.hi || "",
        pa: category.name_i18n?.pa || "",
        gu: category.name_i18n?.gu || ""
      }
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

  const applyTemplate = (slug: string) => {
    if (!slug || slug === "custom") {
      setForm((current) => ({ ...current, template: slug }));
      return;
    }
    const preset = PREDEFINED_CATEGORIES.find((category) => category.slug === slug);
    if (!preset) return;
    setForm((current) => ({
      ...current,
      template: slug,
      name: preset.names.en,
      slug: preset.slug,
      description: current.description || preset.description,
      names: {
        ta: preset.names.ta,
        ml: preset.names.ml,
        kn: preset.names.kn,
        hi: preset.names.hi,
        pa: preset.names.pa,
        gu: preset.names.gu
      }
    }));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isEdit && !form.template) {
      setFormError("Choose a predefined category. Translations are applied automatically.");
      return;
    }
    if (!isEdit && !imageFile) {
      setFormError("Background image is required for the category banner.");
      return;
    }

    setSaving(true);
    setFormError("");

    const preset = form.template && form.template !== "custom"
      ? findPredefinedCategory(form.template)
      : null;
    const payload = {
      name: preset?.names.en || form.name,
      slug: preset?.slug || form.slug || slugify(form.name),
      description: form.description || preset?.description || null,
      sort_order: Number(form.sort_order || 0),
      name_i18n: preset?.names || {
        en: form.name,
        ...form.names
      }
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

  const openAddSub = (category: Category) => {
    setSubParent(category);
    setSubEditing(null);
    setSubForm({ name: "", slug: "", sort_order: String((category.subcategories || []).length) });
    setSubError("");
    setSubModalOpen(true);
  };

  const openEditSub = (category: Category, child: Subcategory) => {
    setSubParent(category);
    setSubEditing(child);
    setSubForm({
      name: child.name,
      slug: child.slug,
      sort_order: String(child.sort_order ?? 0)
    });
    setSubError("");
    setSubModalOpen(true);
  };

  const closeSubModal = () => {
    setSubModalOpen(false);
    setSubParent(null);
    setSubEditing(null);
    setSubForm({ name: "", slug: "", sort_order: "0" });
    setSubError("");
  };

  const onSubSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!subParent) return;
    setSubSaving(true);
    setSubError("");
    const payload = {
      category_id: subParent.id,
      name: subForm.name.trim(),
      slug: subForm.slug || slugify(`${subParent.slug}-${subForm.name}`),
      sort_order: Number(subForm.sort_order || 0)
    };

    const result = subEditing
      ? await adminFetch(`/api/admin/subcategories/${subEditing.id}`, {
          method: "PATCH",
          json: payload
        })
      : await adminFetch("/api/admin/subcategories", { method: "POST", json: payload });

    setSubSaving(false);
    if (result.error) {
      setSubError(result.error);
      return;
    }
    closeSubModal();
    await reload();
  };

  const onDeleteSub = async (child: Subcategory) => {
    const ok = window.confirm(`Delete subcategory “${child.name}”?`);
    if (!ok) return;
    setDeletingSubId(child.id);
    setActionError("");
    const result = await adminFetch(`/api/admin/subcategories/${child.id}`, { method: "DELETE" });
    setDeletingSubId(null);
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
        eyebrow="Catalogue"
        title="Categories"
        description="Organize the storefront into departments and subcategories with banner images."
        actions={
          <button type="button" className="btn" onClick={openCreate}>
            <Plus size={15} />
            New category
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
                <div className="admin-child-list">
                  <div className="admin-child-list-head">
                    <strong>Subcategories</strong>
                    <button
                      type="button"
                      className="admin-action-btn admin-action-btn--compact"
                      onClick={() => openAddSub(category)}
                      title="Add subcategory"
                      aria-label={`Add subcategory under ${category.name}`}
                    >
                      <Plus size={13} strokeWidth={2} />
                      <span>Add</span>
                    </button>
                  </div>
                  {(category.subcategories || []).length === 0 ? (
                    <p className="muted admin-sub">No children yet. Add Silk, Cotton, Earrings, etc.</p>
                  ) : (
                    <ul>
                      {(category.subcategories || []).map((child) => (
                        <li key={child.id}>
                          <span>{child.name}</span>
                          <span className="admin-row-actions">
                            <button
                              type="button"
                              className="admin-action-btn admin-action-btn--compact"
                              onClick={() => openEditSub(category, child)}
                              title="Edit subcategory"
                              aria-label={`Edit subcategory ${child.name}`}
                            >
                              <Pencil size={13} strokeWidth={2} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              className="admin-action-btn admin-action-btn--danger admin-action-btn--compact"
                              disabled={deletingSubId === child.id}
                              onClick={() => void onDeleteSub(child)}
                              title="Delete subcategory"
                              aria-label={`Delete subcategory ${child.name}`}
                            >
                              <Trash2 size={13} strokeWidth={2} />
                              <span>{deletingSubId === child.id ? "…" : "Delete"}</span>
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="muted admin-sub">Added {formatDate(category.created_at)}</p>
                <div className="admin-row-actions" role="group" aria-label="Category actions">
                  <button
                    type="button"
                    className="admin-action-btn"
                    onClick={() => openEdit(category)}
                    title="Edit category"
                    aria-label={`Edit ${category.name}`}
                  >
                    <Pencil size={14} strokeWidth={2} />
                    <span>Edit</span>
                  </button>
                  <label
                    className="admin-action-btn"
                    title="Change background image"
                    aria-label={`Change background for ${category.name}`}
                  >
                    <ImagePlus size={14} strokeWidth={2} />
                    <span>{uploadingId === category.id ? "Uploading…" : "Change background"}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={uploadingId === category.id}
                      hidden
                      onChange={(e) => {
                        void onReplaceImage(category.id, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-action-btn admin-action-btn--danger"
                    disabled={deletingId === category.id}
                    onClick={() => void onDelete(category)}
                    title="Delete category"
                    aria-label={`Delete ${category.name}`}
                  >
                    <Trash2 size={14} strokeWidth={2} />
                    <span>{deletingId === category.id ? "Deleting…" : "Delete"}</span>
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
        <label className="admin-span-2">
          <span>Category</span>
          <select
            required={!isEdit}
            value={form.template}
            onChange={(e) => applyTemplate(e.target.value)}
          >
            <option value="">{isEdit ? "Keep current name" : "Choose a predefined category"}</option>
            {PREDEFINED_CATEGORIES.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.names.en}
              </option>
            ))}
            <option value="custom">Custom name (not auto-translated)</option>
          </select>
          <span className="muted admin-sub">
            Predefined categories switch language automatically (English, Tamil, Malayalam, Kannada,
            Hindi, Punjabi, Gujarati).
          </span>
        </label>
        <label>
          <span>Name (English / default)</span>
          <input
            required
            value={form.name}
            readOnly={Boolean(form.template && form.template !== "custom")}
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
            readOnly={Boolean(form.template && form.template !== "custom")}
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
        {(!form.template || form.template === "custom") &&
          TRANSLATION_LOCALES.map(([code, label]) => (
          <label key={code}>
            <span>Name ({label})</span>
            <input
              value={form.names[code]}
              placeholder={form.name || "Same as English"}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  names: { ...f.names, [code]: e.target.value }
                }))
              }
            />
          </label>
        ))}
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

      <AdminFormModal
        open={subModalOpen}
        title={subEditing ? "Edit subcategory" : "Add subcategory"}
        eyebrow={subParent ? `Child of ${subParent.name}` : "Catalogue"}
        submitLabel={subEditing ? "Save changes" : "Create subcategory"}
        savingLabel={subEditing ? "Saving…" : "Creating…"}
        saving={subSaving}
        error={subError}
        onClose={closeSubModal}
        onSubmit={onSubSubmit}
      >
        <label className="admin-span-2">
          <span>Name</span>
          <input
            required
            value={subForm.name}
            onChange={(e) =>
              setSubForm((f) => ({
                ...f,
                name: e.target.value,
                slug: subEditing ? f.slug : slugify(`${subParent?.slug || ""}-${e.target.value}`)
              }))
            }
          />
        </label>
        <label>
          <span>Slug</span>
          <input
            required
            value={subForm.slug}
            onChange={(e) => setSubForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
          />
        </label>
        <label>
          <span>Sort order</span>
          <input
            type="number"
            value={subForm.sort_order}
            onChange={(e) => setSubForm((f) => ({ ...f, sort_order: e.target.value }))}
          />
        </label>
      </AdminFormModal>
    </>
  );
}
