"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Printer, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { AdminAlert, slugify } from "./admin-ui";
import { adminFetch, getAdminToken } from "../../lib/admin-api";

export type ProductFormCategory = { id: string; name: string; slug: string };

export type ProductFormImage = {
  id?: string;
  storage_path: string;
  preview?: string;
  file?: File;
  isNew?: boolean;
};

export type ProductFormValues = {
  id?: string;
  name: string;
  slug: string;
  sku: string;
  barcode: string;
  category_id: string;
  price: string;
  compare_at_price: string;
  stock_quantity: string;
  status: string;
  short_description: string;
  color: string;
  description: string;
  is_featured: boolean;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  categories: ProductFormCategory[];
  initial: ProductFormValues;
  initialImages?: ProductFormImage[];
  onClose: () => void;
  onSaved: () => void;
};

const emptyImages: ProductFormImage[] = [];

function generateSku() {
  return `VAS-${Date.now().toString().slice(-8)}`;
}

function barcodeFromSku(sku: string) {
  return sku.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16);
}

export function ProductFormModal({
  open,
  mode,
  categories,
  initial,
  initialImages = emptyImages,
  onClose,
  onSaved
}: Props) {
  const [form, setForm] = useState(initial);
  const [images, setImages] = useState<ProductFormImage[]>(initialImages);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(initial);
    setImages(initialImages);
    setError("");
  }, [open, initial, initialImages]);

  useEffect(() => {
    if (!open || !barcodeRef.current || !form.barcode) return;
    try {
      JsBarcode(barcodeRef.current, form.barcode, {
        format: "CODE128",
        width: 2,
        height: 64,
        displayValue: true,
        fontSize: 14,
        margin: 8
      });
    } catch {
      // invalid barcode characters — ignore until valid
    }
  }, [open, form.barcode]);

  if (!open) return null;

  const regenerateCodes = () => {
    const sku = generateSku();
    setForm((current) => ({
      ...current,
      sku,
      barcode: barcodeFromSku(sku) || sku.replace(/-/g, "")
    }));
  };

  const onPickFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const remaining = 5 - images.length;
    if (remaining <= 0) {
      setError("Maximum 5 images allowed");
      return;
    }

    const picked = Array.from(fileList).slice(0, remaining);
    const next: ProductFormImage[] = [];

    for (const file of picked) {
      if (!file.type.startsWith("image/")) {
        setError("Only image files are allowed");
        continue;
      }
      if (file.size > 4 * 1024 * 1024) {
        setError("Each image must be under 4MB");
        continue;
      }
      const preview = await readAsDataUrl(file);
      next.push({ storage_path: "", preview, file, isNew: true });
    }

    setImages((current) => [...current, ...next].slice(0, 5));
  };

  const removeImage = async (index: number) => {
    const target = images[index];
    if (target?.id && form.id) {
      await adminFetch(`/api/admin/products/${form.id}/images?imageId=${target.id}`, {
        method: "DELETE"
      });
    }
    setImages((current) => current.filter((_, i) => i !== index));
  };

  const printBarcode = () => {
    if (!form.barcode) return;
    const svg = barcodeRef.current;
    if (!svg) return;
    const markup = svg.outerHTML;
    const win = window.open("", "_blank", "noopener,noreferrer,width=480,height=360");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>Barcode ${form.barcode}</title>
      <style>
        body{font-family:sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}
        .card{text-align:center}
        h1{font-size:16px;margin:0 0 12px}
        p{margin:8px 0 0;font-size:12px;color:#555}
      </style></head><body>
      <div class="card">
        <h1>${form.name || "Vasritha product"}</h1>
        ${markup}
        <p>Code: ${form.sku || "—"} · Barcode: ${form.barcode}</p>
      </div>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    win.document.close();
  };

  const uploadPendingImages = async (productId: string) => {
    const token = getAdminToken();
    for (const image of images) {
      if (!image.isNew || !image.file) continue;
      const body = new FormData();
      body.append("file", image.file);
      const res = await fetch(`/api/admin/products/${productId}/images`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error || "Image upload failed");
      }
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    if (images.length < 3) {
      setError("Add at least 3 product images before saving");
      setSaving(false);
      return;
    }

    if (!form.color.trim()) {
      setError("Enter a colour for this product");
      setSaving(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      slug: form.slug || slugify(form.name),
      sku: form.sku.trim() || generateSku(),
      barcode: form.barcode.trim() || barcodeFromSku(form.sku.trim() || form.name) || generateSku().replace(/-/g, ""),
      category_id: form.category_id,
      price: Number(form.price),
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      stock_quantity: Number(form.stock_quantity || 0),
      status: form.status,
      color: form.color.trim(),
      short_description: form.short_description.trim(),
      description: form.description.trim(),
      is_featured: Boolean(form.is_featured)
    };

    try {
      if (mode === "create") {
        const created = await adminFetch<{ id: string }>("/api/admin/products", {
          method: "POST",
          json: payload
        });
        if (created.error || !created.data?.id) throw new Error(created.error || "Create failed");
        await uploadPendingImages(created.data.id);
      } else if (form.id) {
        const updated = await adminFetch(`/api/admin/products/${form.id}`, {
          method: "PATCH",
          json: payload
        });
        if (updated.error) throw new Error(updated.error);
        await uploadPendingImages(form.id);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-modal-head">
          <div>
            <p className="eyebrow">{mode === "create" ? "New catalogue item" : "Update catalogue item"}</p>
            <h2 id="product-modal-title">{mode === "create" ? "Add product" : "Edit product"}</h2>
          </div>
          <button type="button" className="admin-modal-close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="admin-modal-body" onSubmit={onSubmit}>
          <div className="admin-form-grid">
            <label>
              <span>Name</span>
              <input
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: mode === "create" ? slugify(e.target.value) : f.slug || slugify(e.target.value)
                  }))
                }
              />
            </label>

            <label>
              <span>Colour</span>
              <input
                required
                list="product-colour-suggestions"
                value={form.color ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                placeholder="e.g. Blush Pink, Crimson Red, Antique Gold"
              />
              <datalist id="product-colour-suggestions">
                <option value="Crimson Red" />
                <option value="Blush Pink" />
                <option value="Ivory Cream" />
                <option value="Indigo Blue" />
                <option value="Antique Gold" />
                <option value="Gold" />
                <option value="Multicolour" />
                <option value="Natural Wood" />
                <option value="Antique Brass" />
                <option value="Maroon" />
                <option value="Emerald Green" />
                <option value="Black" />
                <option value="White" />
              </datalist>
              <small className="admin-field-hint">Shown on the product page under the price.</small>
            </label>

            <label>
              <span>Slug (URL name)</span>
              <input
                required
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
              />
              <small className="admin-field-hint">
                Used in the product link, e.g. /products/aarohi-kanchipuram-silk
              </small>
            </label>

            <label>
              <span>Product code (SKU)</span>
              <div className="admin-input-with-action">
                <input
                  required
                  value={form.sku}
                  onChange={(e) => {
                    const sku = e.target.value;
                    setForm((f) => ({
                      ...f,
                      sku,
                      barcode: barcodeFromSku(sku)
                    }));
                  }}
                  placeholder="VAS-12345678"
                />
                <button type="button" className="admin-icon-btn" title="Generate code" onClick={regenerateCodes}>
                  <RefreshCw size={15} />
                </button>
              </div>
              <small className="admin-field-hint">Barcode updates automatically when you change the product code.</small>
            </label>

            <label>
              <span>Barcode</span>
              <div className="admin-input-with-action">
                <input
                  required
                  value={form.barcode}
                  onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value.toUpperCase() }))}
                />
                <button type="button" className="admin-icon-btn" title="Print barcode" onClick={printBarcode}>
                  <Printer size={15} />
                </button>
              </div>
            </label>

            <label>
              <span>Category</span>
              <select
                required
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Status</span>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
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

            <label className="admin-span-2 admin-check-field">
              <span className="admin-check-row">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_featured)}
                  onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
                />
                <span>Fast selling</span>
              </span>
              <small className="admin-field-hint">
                Show this product in the homepage Fast Selling section.
              </small>
            </label>

            <label className="admin-span-2">
              <span>Short description</span>
              <textarea
                rows={2}
                maxLength={220}
                value={form.short_description}
                onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
                placeholder="One or two lines for cards and listings"
              />
              <small className="admin-field-hint">{form.short_description.length}/220</small>
            </label>

            <label className="admin-span-2">
              <span>Long description</span>
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Full product story, fabric details, care notes…"
              />
            </label>
          </div>

          <div className="admin-barcode-preview">
            <div className="admin-barcode-preview-head">
              <strong>Barcode preview</strong>
              <button type="button" className="admin-text-link" onClick={printBarcode}>
                Print barcode
              </button>
            </div>
            <svg ref={barcodeRef} />
          </div>

          <div className="admin-image-uploader">
            <div className="admin-barcode-preview-head">
              <strong>Images (min 3, max 5)</strong>
              <span className="muted">{images.length}/5</span>
            </div>
            <div className="admin-image-grid">
              {images.map((image, index) => (
                <div key={`${image.id || image.preview}-${index}`} className="admin-image-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.preview || image.storage_path} alt="" />
                  <button type="button" aria-label="Remove image" onClick={() => void removeImage(index)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <button
                  type="button"
                  className="admin-image-add"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={18} />
                  Upload
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              hidden
              onChange={(e) => {
                void onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {error ? <AdminAlert>{error}</AdminAlert> : null}

          <div className="admin-modal-actions">
            <button type="button" className="admin-ghost-btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function blankProductForm(categoryId = ""): ProductFormValues {
  const sku = generateSku();
  return {
    name: "",
    slug: "",
    sku,
    barcode: barcodeFromSku(sku) || sku.replace(/-/g, ""),
    category_id: categoryId,
    price: "",
    compare_at_price: "",
    stock_quantity: "0",
    status: "draft",
    short_description: "",
    color: "",
    description: "",
    is_featured: false
  };
}
