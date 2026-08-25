"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Printer, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { AdminAlert, slugify } from "./admin-ui";
import { adminFetch, getAdminToken } from "../../lib/admin-api";
import { printProductStickers } from "../../lib/print-stickers";

export type ProductFormCategory = {
  id: string;
  name: string;
  slug: string;
  subcategories?: Array<{ id: string; name: string; slug: string }>;
};

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
  short_name: string;
  slug: string;
  sku: string;
  barcode: string;
  tag: string;
  sku_prefix: string;
  label_size: "accessory" | "dress";
  image_upload_token?: string;
  category_id: string;
  subcategory_id: string;
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
  const [units, setUnits] = useState<
    Array<{ id: string; unit_code: string; barcode: string; status?: string; label_printed?: boolean }>
  >([]);
  const [printBusy, setPrintBusy] = useState(false);
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(initial);
    setImages(initialImages);
    setError("");
    setUnits([]);
  }, [open, initial, initialImages]);

  useEffect(() => {
    if (!open || !form.id) return;
    void (async () => {
      const result = await adminFetch<{
        items: Array<{
          id: string;
          unit_code: string;
          barcode: string;
          status?: string;
          label_printed?: boolean;
        }>;
      }>(`/api/admin/products/${form.id}/items`);
      if (result.data?.items) setUnits(result.data.items);
    })();
  }, [open, form.id]);

  useEffect(() => {
    if (!open || !barcodeRef.current) return;
    const value = (units[0]?.barcode || form.barcode || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!value) return;
    try {
      JsBarcode(barcodeRef.current, value, {
        format: "CODE128",
        width: 2,
        height: 56,
        displayValue: true,
        fontSize: 12,
        margin: 4
      });
    } catch {
      // invalid barcode characters — ignore until valid
    }
  }, [open, form.barcode, units]);

  if (!open) return null;

  const regenerateCodes = () => {
    const sku = `${form.sku_prefix || "VAS"}-${Date.now().toString().slice(-8)}`;
    setForm((current) => ({
      ...current,
      sku,
      tag: current.tag || sku,
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

  const reloadUnits = async (productId: string) => {
    const result = await adminFetch<{
      items: Array<{
        id: string;
        unit_code: string;
        barcode: string;
        status?: string;
        label_printed?: boolean;
      }>;
    }>(`/api/admin/products/${productId}/items`);
    if (result.data?.items) setUnits(result.data.items);
    return result.data?.items || [];
  };

  const printStickers = async (kind: "pending" | "all" | "family") => {
    setError("");
    setPrintBusy(true);
    try {
      if (kind === "family") {
        const code = (form.barcode || form.sku).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        if (!code) throw new Error("Enter a product code before printing.");
        printProductStickers({
          price: form.price,
          labelSize: form.label_size,
          items: [{ unit_code: form.sku || code, barcode: code }]
        });
        return;
      }

      let rows = units;
      if (form.id) {
        rows = await reloadUnits(form.id);
      }
      const sellable = rows.filter((u) => !u.status || u.status === "to_sell");
      const pending = sellable.filter((u) => !u.label_printed);
      const chosen = kind === "pending" ? pending : sellable;
      if (!chosen.length) {
        throw new Error(
          kind === "pending"
            ? "No unprinted stickers left. Use Print all, or inward more stock."
            : "No unique barcodes yet. Set opening stock and save, or inward stock."
        );
      }
      printProductStickers({
        price: form.price,
        labelSize: form.label_size,
        items: chosen
      });
      if (form.id && chosen.some((row) => row.id)) {
        await adminFetch(`/api/admin/products/${form.id}/items`, {
          method: "PATCH",
          json: {
            itemIds: chosen.map((row) => row.id).filter(Boolean),
            label_printed: true
          }
        });
        await reloadUnits(form.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not print barcodes");
    } finally {
      setPrintBusy(false);
    }
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

    if (!form.color.trim()) {
      setError("Enter a colour for this product");
      setSaving(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      short_name: form.short_name.trim(),
      slug: form.slug || slugify(form.name),
      sku: form.sku.trim() || generateSku(),
      barcode: form.barcode.trim() || barcodeFromSku(form.sku.trim() || form.name) || generateSku().replace(/-/g, ""),
      tag: (form.tag.trim() || form.sku.trim()).toUpperCase(),
      sku_prefix: (form.sku_prefix || "VAS").toUpperCase(),
      label_size: form.label_size,
      category_id: form.category_id,
      subcategory_id: form.subcategory_id || null,
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
        const created = await adminFetch<{
          id: string;
          image_upload_token?: string;
          product_items?: Array<{ id: string; unit_code: string; barcode: string; status?: string }>;
        }>("/api/admin/products", {
          method: "POST",
          json: payload
        });
        if (created.error || !created.data?.id) throw new Error(created.error || "Create failed");
        await uploadPendingImages(created.data.id);
        setForm((f) => ({
          ...f,
          id: created.data!.id,
          image_upload_token: created.data!.image_upload_token
        }));
        setUnits(created.data.product_items || []);
        onSaved();
        return;
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
              <span>Short name</span>
              <input
                value={form.short_name}
                onChange={(e) => setForm((f) => ({ ...f, short_name: e.target.value }))}
                placeholder="Shown on listing cards"
              />
              <small className="admin-field-hint">Optional. e.g. Aarohi Kanchipuram</small>
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
              <span>SKU prefix</span>
              <select
                value={form.sku_prefix}
                onChange={(e) => setForm((f) => ({ ...f, sku_prefix: e.target.value.toUpperCase() }))}
              >
                <option value="VAS">VAS</option>
                <option value="PADH">PADH</option>
                <option value="VRSH">VRSH</option>
              </select>
            </label>

            <label>
              <span>Connecting tag</span>
              <input
                value={form.tag}
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value.toUpperCase() }))}
                placeholder="Same tag on every unique piece"
              />
              <small className="admin-field-hint">Connects all unique barcodes of this product.</small>
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
              <small className="admin-field-hint">Family code. Each piece gets its own unique barcode from this.</small>
            </label>

            <label>
              <span>Label size</span>
              <select
                value={form.label_size}
                onChange={(e) =>
                  setForm((f) => ({ ...f, label_size: e.target.value as "accessory" | "dress" }))
                }
              >
                <option value="dress">Dress / saree (standard)</option>
                <option value="accessory">Accessory (small printer)</option>
              </select>
            </label>

            <label>
              <span>Family barcode</span>
              <div className="admin-input-with-action">
                <input
                  required
                  value={form.barcode}
                  onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value.toUpperCase() }))}
                />
                <button
                  type="button"
                  className="admin-icon-btn"
                  title="Print barcode sticker"
                  onClick={() => void printStickers("family")}
                  disabled={printBusy}
                >
                  <Printer size={15} />
                </button>
              </div>
            </label>

            <label>
              <span>Category</span>
              <select
                required
                value={form.category_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category_id: e.target.value, subcategory_id: "" }))
                }
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
              <span>Subcategory</span>
              <select
                value={form.subcategory_id}
                onChange={(e) => setForm((f) => ({ ...f, subcategory_id: e.target.value }))}
              >
                <option value="">None</option>
                {(categories.find((c) => c.id === form.category_id)?.subcategories || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <small className="admin-field-hint">Child of the selected category. Used in inventory too.</small>
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
              <small className="admin-field-hint">Shown with a strikethrough next to the selling price.</small>
            </label>

            <label>
              <span>Opening stock (unique pieces)</span>
              <input
                type="number"
                min="0"
                value={form.stock_quantity}
                onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
                disabled={Boolean(form.id)}
              />
              <small className="admin-field-hint">
                {form.id
                  ? "Add more unique barcodes from Inventory → Inward."
                  : "10 stock = 10 unique barcode stickers."}
              </small>
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
              <strong>Barcode stickers</strong>
              <span className="muted">
                {units.filter((u) => !u.status || u.status === "to_sell").length} unique
                {units.some((u) => !u.label_printed && (!u.status || u.status === "to_sell"))
                  ? ` · ${units.filter((u) => !u.label_printed && (!u.status || u.status === "to_sell")).length} not printed`
                  : ""}
              </span>
            </div>
            <div className="admin-sticker-actions">
              <button
                type="button"
                className="btn"
                disabled={printBusy}
                onClick={() => void printStickers("pending")}
              >
                {printBusy ? "Printing…" : "Print new stickers"}
              </button>
              <button
                type="button"
                className="admin-ghost-btn"
                disabled={printBusy}
                onClick={() => void printStickers("all")}
              >
                Print all unique
              </button>
              <button
                type="button"
                className="admin-ghost-btn"
                disabled={printBusy}
                onClick={() => void printStickers("family")}
              >
                Print sample size
              </button>
            </div>
            <small className="admin-field-hint">
              Uses {form.label_size === "accessory" ? "small accessory" : "standard dress"} sticker size. Allow the print dialog — it no longer needs a popup window.
            </small>
            <svg ref={barcodeRef} className="admin-barcode-live" />
            {units.length ? (
              <div className="admin-unit-list">
                {units.map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    className="admin-unit-row"
                    onClick={() => {
                      if (!barcodeRef.current) return;
                      try {
                        JsBarcode(barcodeRef.current, unit.barcode, {
                          format: "CODE128",
                          width: 2,
                          height: 56,
                          displayValue: true,
                          fontSize: 12,
                          margin: 4
                        });
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    {unit.unit_code} · {unit.barcode}
                    {unit.status ? ` · ${unit.status}` : ""}
                    {unit.label_printed ? " · printed" : " · not printed"}
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">Save with stock, or inward later, to generate unique barcodes.</p>
            )}
          </div>

          {form.image_upload_token ? (
            <div className="admin-qr-box">
              <strong>Scan to upload photos</strong>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Upload QR"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  `${typeof window !== "undefined" ? window.location.origin : ""}/part/${form.image_upload_token || ""}`
                )}`}
              />
              <small className="admin-field-hint">
                Phone camera opens image upload for this product.
              </small>
            </div>
          ) : null}

          <div className="admin-image-uploader">
            <div className="admin-barcode-preview-head">
              <strong>Images (optional now — QR or upload, max 5)</strong>
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
              {mode === "create" && form.id ? "Done" : "Cancel"}
            </button>
            {!(mode === "create" && form.id) ? (
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
              </button>
            ) : null}
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
    short_name: "",
    slug: "",
    sku,
    barcode: barcodeFromSku(sku) || sku.replace(/-/g, ""),
    tag: sku,
    sku_prefix: "VAS",
    label_size: "dress",
    category_id: categoryId,
    subcategory_id: "",
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
