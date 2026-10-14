"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { ArrowLeft, Check, Printer, QrCode, RefreshCw, Save, Trash2, Upload, X } from "lucide-react";
import { AdminAlert, AdminPageHeader, slugify } from "./admin-ui";
import { AdminSelectPopup } from "./admin-select-popup";
import { ColorField } from "./color-field";
import { adminFetch, getAdminToken, getAdminUser } from "../../lib/admin-api";
import {
  ALLOWED_GST_RATES,
  COMMON_GARMENT_HSN,
  isReadymadeGarmentHsn,
  resolveSaleGstRate
} from "../../lib/gst-math";
import { buildProductUploadPageUrl } from "../../lib/product-upload-url";
import { LABEL_LAYOUT_OPTIONS, labelSizeToLayout, printProductStickers } from "../../lib/print-stickers";
import {
  firstError,
  validateHsn,
  validatePositiveMoney,
  validateRequired
} from "../../lib/validation";

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
  kind?: "website" | "internal";
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
  parent_product_id: string;
  price: string;
  compare_at_price: string;
  hsn_code: string;
  gst_rate: string;
  stock_quantity: string;
  status: string;
  short_description: string;
  color: string;
  /** When true, piece colours are set at GRN — product-level colour is optional. */
  is_multicolour: boolean;
  description: string;
  is_featured: boolean;
  restock_expected: boolean;
};

export type ProductParentOption = {
  id: string;
  name: string;
  sku?: string | null;
  color?: string | null;
};

type Props = {
  mode: "create" | "edit";
  categories: ProductFormCategory[];
  parentOptions?: ProductParentOption[];
  initial: ProductFormValues;
  initialImages?: ProductFormImage[];
  initialInternalImages?: ProductFormImage[];
  onClose: () => void;
  onSaved: (created?: { id: string; defaultVariantId?: string | null }) => void;
};

const emptyImages: ProductFormImage[] = [];
const MAX_KIND_IMAGES = 5;

function generateSku() {
  return `VAS-${Date.now().toString().slice(-8)}`;
}

function barcodeFromSku(sku: string) {
  return sku.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16);
}

export function ProductForm({
  mode,
  categories,
  parentOptions = [],
  initial,
  initialImages = emptyImages,
  initialInternalImages = emptyImages,
  onClose,
  onSaved
}: Props) {
  const [form, setForm] = useState(initial);
  const [websiteImages, setWebsiteImages] = useState<ProductFormImage[]>(initialImages);
  const [internalImages, setInternalImages] = useState<ProductFormImage[]>(initialInternalImages);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [units, setUnits] = useState<
    Array<{
      id: string;
      unit_code: string;
      barcode: string;
      status?: string;
      label_printed?: boolean;
      color?: string | null;
      variant_name?: string | null;
    }>
  >([]);
  const [printBusy, setPrintBusy] = useState(false);
  const [websiteQrDataUrl, setWebsiteQrDataUrl] = useState("");
  const [internalQrDataUrl, setInternalQrDataUrl] = useState("");
  const [qrRefreshing, setQrRefreshing] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const websiteFileRef = useRef<HTMLInputElement | null>(null);
  const internalFileRef = useRef<HTMLInputElement | null>(null);
  const photosRef = useRef<HTMLDivElement | null>(null);
  const canApproveProducts = Boolean(
    getAdminUser()?.permissions?.includes("products:approve") ||
      ["super_admin", "business_owner", "manager"].includes(getAdminUser()?.primaryRole || "")
  );

  useEffect(() => {
    setForm(initial);
    setWebsiteImages(initialImages);
    setInternalImages(initialInternalImages);
    setError("");
    setUnits([]);
    setJustCreated(false);
  }, [initial, initialImages, initialInternalImages]);

  // Readymade garments (HSN 61/62): GST follows sale value per piece (₹2,500 slab).
  useEffect(() => {
    if (!isReadymadeGarmentHsn(form.hsn_code)) return;
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return;
    const next = String(
      resolveSaleGstRate({
        hsnCode: form.hsn_code,
        saleValuePerPiece: price,
        fallbackRate: form.gst_rate
      })
    );
    if (next !== form.gst_rate) {
      setForm((f) => ({ ...f, gst_rate: next }));
    }
  }, [form.hsn_code, form.price, form.gst_rate]);

  useEffect(() => {
    if (!form.image_upload_token) {
      setWebsiteQrDataUrl("");
      setInternalQrDataUrl("");
      return;
    }
    const origin = window.location.origin;
    const websiteUrl = buildProductUploadPageUrl(form.image_upload_token, origin, "website");
    const internalUrl = buildProductUploadPageUrl(form.image_upload_token, origin, "internal");
    void QRCode.toDataURL(websiteUrl, { margin: 1, width: 180 })
      .then(setWebsiteQrDataUrl)
      .catch(() => setWebsiteQrDataUrl(""));
    void QRCode.toDataURL(internalUrl, { margin: 1, width: 180 })
      .then(setInternalQrDataUrl)
      .catch(() => setInternalQrDataUrl(""));
  }, [form.image_upload_token]);

  useEffect(() => {
    if (!form.id) return;
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
  }, [form.id]);

  useEffect(() => {
    if (!barcodeRef.current) return;
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
  }, [form.barcode, units]);

  const regenerateCodes = () => {
    const sku = `${form.sku_prefix || "VAS"}-${Date.now().toString().slice(-8)}`;
    setForm((current) => ({
      ...current,
      sku,
      tag: current.tag || sku,
      barcode: barcodeFromSku(sku) || sku.replace(/-/g, "")
    }));
  };

  const onPickFiles = async (
    fileList: FileList | null,
    kind: "website" | "internal"
  ) => {
    if (!fileList?.length) return;
    const current = kind === "website" ? websiteImages : internalImages;
    const setList = kind === "website" ? setWebsiteImages : setInternalImages;
    const remaining = MAX_KIND_IMAGES - current.length;
    if (remaining <= 0) {
      setError(`Maximum ${MAX_KIND_IMAGES} ${kind} images allowed`);
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
      next.push({ storage_path: "", preview, file, isNew: true, kind });
    }

    setList((prev) => [...prev, ...next].slice(0, MAX_KIND_IMAGES));
  };

  const removeImage = async (index: number, kind: "website" | "internal") => {
    const list = kind === "website" ? websiteImages : internalImages;
    const setList = kind === "website" ? setWebsiteImages : setInternalImages;
    const target = list[index];
    if (target?.id && form.id) {
      await adminFetch(`/api/admin/products/${form.id}/images?imageId=${target.id}`, {
        method: "DELETE"
      });
    }
    setList((current) => current.filter((_, i) => i !== index));
  };

  const refreshRemoteImages = async () => {
    if (!form.id) return;
    setQrRefreshing(true);
    try {
      const result = await adminFetch<{
        product_images?: Array<{ id: string; storage_path: string; image_kind?: string }>;
        internal_images?: Array<{ id: string; storage_path: string; image_kind?: string }>;
      }>(`/api/admin/products/${form.id}`);
      if (result.error || !result.data) return;
      const keepLocal = (list: ProductFormImage[]) => list.filter((row) => row.isNew && row.file);
      setWebsiteImages([
        ...keepLocal(websiteImages),
        ...(result.data.product_images || []).map((image) => ({
          id: image.id,
          storage_path: image.storage_path,
          kind: "website" as const
        }))
      ].slice(0, MAX_KIND_IMAGES));
      setInternalImages([
        ...keepLocal(internalImages),
        ...(result.data.internal_images || []).map((image) => ({
          id: image.id,
          storage_path: image.storage_path,
          kind: "internal" as const
        }))
      ].slice(0, MAX_KIND_IMAGES));
    } finally {
      setQrRefreshing(false);
    }
  };

  const reloadUnits = async (productId: string) => {
    const result = await adminFetch<{
      items: Array<{
        id: string;
        unit_code: string;
        barcode: string;
        status?: string;
        label_printed?: boolean;
        color?: string | null;
      }>;
    }>(`/api/admin/products/${productId}/items`);
    if (result.data?.items) setUnits(result.data.items);
    return result.data?.items || [];
  };

  const printStickers = async (kind: "pending" | "all" | "family") => {
    setError("");
    setPrintBusy(true);
    try {
      const category = categories.find((c) => c.id === form.category_id);
      const subcategory = category?.subcategories?.find((s) => s.id === form.subcategory_id);
      const stickerMeta = {
        productName: form.name,
        shortName: form.short_name || undefined,
        categoryName: subcategory?.name || category?.name,
        sku: form.sku,
        color: form.is_multicolour ? undefined : form.color,
        tag: form.tag,
        hsnCode: form.hsn_code || undefined,
        compareAtPrice: form.compare_at_price
      };

      if (kind === "family") {
        const code = (form.barcode || form.sku).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        if (!code) throw new Error("Enter a product code before printing.");
        await printProductStickers({
          price: form.price,
          layout: labelSizeToLayout(form.label_size),
          labelSize: form.label_size,
          meta: stickerMeta,
          items: [
            {
              unit_code: form.sku || code,
              barcode: code,
              color: form.is_multicolour ? null : form.color
            }
          ]
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
      await printProductStickers({
        price: form.price,
        layout: labelSizeToLayout(form.label_size),
        labelSize: form.label_size,
        meta: stickerMeta,
        items: chosen.map((row) => {
          const pieceColor = (row.color || (!form.is_multicolour ? form.color : "") || "").trim();
          return {
            ...row,
            color: pieceColor || null,
            sizeLabel: row.variant_name || null
          };
        })
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
    const pending = [
      ...websiteImages.map((image) => ({ image, kind: "website" as const })),
      ...internalImages.map((image) => ({ image, kind: "internal" as const }))
    ];
    for (const { image, kind } of pending) {
      if (!image.isNew || !image.file) continue;
      const body = new FormData();
      body.append("file", image.file);
      body.append("kind", kind);
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

    const gstRate = Number(form.gst_rate || 5);
    const fieldError = firstError(
      validateRequired(form.name, "Product name"),
      validateRequired(form.category_id, "Category"),
      form.is_multicolour ? null : validateRequired(form.color, "Colour"),
      validatePositiveMoney(form.price, { required: true, label: "Price" }),
      form.compare_at_price
        ? validatePositiveMoney(form.compare_at_price, { required: false, label: "Compare-at price" })
        : null,
      validateHsn(form.hsn_code, { required: false }),
      (ALLOWED_GST_RATES as readonly number[]).includes(gstRate)
        ? null
        : "GST rate must be 0, 3, 5, 9, 12, or 18"
    );
    if (fieldError) {
      setError(fieldError);
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
      parent_product_id: form.parent_product_id || null,
      price: Number(form.price),
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      hsn_code: form.hsn_code.trim() || null,
      gst_rate: resolveSaleGstRate({
        hsnCode: form.hsn_code,
        saleValuePerPiece: Number(form.price),
        fallbackRate: form.gst_rate
      }),
      stock_quantity: form.is_multicolour ? 0 : Number(form.stock_quantity || 0),
      status:
        !canApproveProducts && (form.status === "rejected" || form.status === "active")
          ? "pending_approval"
          : form.status,
      color: form.is_multicolour ? "" : form.color.trim(),
      is_multicolour: Boolean(form.is_multicolour),
      short_description: form.short_description.trim(),
      description: form.description.trim(),
      is_featured: Boolean(form.is_featured),
      restock_expected: Boolean(form.restock_expected)
    };

    try {
      if (mode === "create") {
        const created = await adminFetch<{
          id: string;
          image_upload_token?: string;
          default_variant_id?: string | null;
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
        setJustCreated(true);
        // Reload galleries so phone QR + thumbs match the server after create.
        const fresh = await adminFetch<{
          product_images?: Array<{ id: string; storage_path: string }>;
          internal_images?: Array<{ id: string; storage_path: string }>;
        }>(`/api/admin/products/${created.data.id}`);
        if (fresh.data) {
          setWebsiteImages(
            (fresh.data.product_images || []).map((image) => ({
              id: image.id,
              storage_path: image.storage_path,
              kind: "website" as const
            }))
          );
          setInternalImages(
            (fresh.data.internal_images || []).map((image) => ({
              id: image.id,
              storage_path: image.storage_path,
              kind: "internal" as const
            }))
          );
        }
        onSaved({
          id: created.data.id,
          defaultVariantId: created.data.default_variant_id
        });
        requestAnimationFrame(() => {
          photosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        return;
      } else if (form.id) {
        const updated = await adminFetch(`/api/admin/products/${form.id}`, {
          method: "PATCH",
          json: payload
        });
        if (updated.error) throw new Error(updated.error);
        await uploadPendingImages(form.id);
        setJustCreated(false);
        setError("");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  };

  const isCreatedSession = Boolean(form.id);
  const heading = mode === "edit" || isCreatedSession ? "Edit product" : "Add product";

  return (
    <div className="admin-stack admin-product-form-page">
      <AdminPageHeader
        title={heading}
        actions={
          <button
            type="button"
            className="admin-icon-tip"
            onClick={onClose}
            data-tooltip="Back"
            aria-label="Back to products"
          >
            <ArrowLeft size={16} strokeWidth={2} />
            <span>Back</span>
          </button>
        }
      />

      <form className="admin-panel admin-product-form" onSubmit={onSubmit}>
          {justCreated ? <AdminAlert tone="ok">Product created.</AdminAlert> : null}
          <div className="admin-form-grid admin-form-grid--fields">
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
              />
            </label>

            <label className="admin-span-2 admin-check-field">
              <span className="admin-check-row">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_multicolour)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      is_multicolour: e.target.checked,
                      color: e.target.checked ? "" : f.color,
                      stock_quantity: e.target.checked ? "0" : f.stock_quantity
                    }))
                  }
                />
                <span>Multi-colour product</span>
              </span>
            </label>

            <label>
              <span>Colour</span>
              <ColorField
                id="product-form-colour"
                required={!form.is_multicolour}
                disabled={form.is_multicolour}
                value={form.color ?? ""}
                onChange={(color) => setForm((f) => ({ ...f, color }))}
                upsertOnBlur={!form.is_multicolour}
              />
            </label>

            <label>
              <span>Slug (URL name)</span>
              <input
                required
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
              />
            </label>

            <label>
              <span>SKU prefix</span>
              <AdminSelectPopup
                title="SKU prefix"
                value={form.sku_prefix}
                options={[
                  { value: "VAS", label: "VAS" },
                  { value: "PADH", label: "PADH" },
                  { value: "VRSH", label: "VRSH" }
                ]}
                onChange={(sku_prefix) => setForm((f) => ({ ...f, sku_prefix: sku_prefix.toUpperCase() }))}
              />
            </label>

            <label>
              <span>Connecting tag</span>
              <input
                value={form.tag}
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value.toUpperCase() }))}
              />
            </label>

            <label>
              <span>HSN code</span>
              <input
                value={form.hsn_code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hsn_code: e.target.value.replace(/\D/g, "").slice(0, 8) }))
                }
                inputMode="numeric"
                maxLength={8}
              />
              <div className="admin-chip-row" style={{ marginTop: 6 }}>
                {COMMON_GARMENT_HSN.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    className={`admin-chip-btn${form.hsn_code === item.code ? " is-active" : ""}`}
                    title={item.label}
                    onClick={() => setForm((f) => ({ ...f, hsn_code: item.code }))}
                  >
                    {item.code}
                  </button>
                ))}
              </div>
            </label>

            <label>
              <span>GST rate %</span>
              <AdminSelectPopup
                title="GST rate %"
                value={form.gst_rate}
                disabled={isReadymadeGarmentHsn(form.hsn_code)}
                options={[
                  { value: "0", label: "0%" },
                  { value: "3", label: "3%" },
                  { value: "5", label: "5%" },
                  { value: "9", label: "9%" },
                  { value: "12", label: "12%" },
                  { value: "18", label: "18%" }
                ]}
                onChange={(gst_rate) => setForm((f) => ({ ...f, gst_rate }))}
              />
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
                />
                <button type="button" className="admin-icon-btn" title="Generate code" onClick={regenerateCodes}>
                  <RefreshCw size={15} />
                </button>
              </div>
            </label>

            <label>
              <span>Label type</span>
              <AdminSelectPopup
                title="Label type"
                value={form.label_size}
                options={LABEL_LAYOUT_OPTIONS.map((opt) => ({
                  value: opt.code,
                  label: opt.label
                }))}
                onChange={(label_size) =>
                  setForm((f) => ({ ...f, label_size: label_size as "accessory" | "dress" }))
                }
              />
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
              <AdminSelectPopup
                title="Category"
                required
                value={form.category_id}
                placeholder="Select category"
                options={[
                  { value: "", label: "Select category" },
                  ...categories.map((c) => ({ value: c.id, label: c.name }))
                ]}
                onChange={(category_id) =>
                  setForm((f) => ({ ...f, category_id, subcategory_id: "" }))
                }
              />
            </label>

            <label>
              <span>Subcategory</span>
              <AdminSelectPopup
                title="Subcategory"
                value={form.subcategory_id}
                placeholder="None"
                options={[
                  { value: "", label: "None" },
                  ...(categories.find((c) => c.id === form.category_id)?.subcategories || []).map(
                    (item) => ({ value: item.id, label: item.name })
                  )
                ]}
                onChange={(subcategory_id) => setForm((f) => ({ ...f, subcategory_id }))}
              />
            </label>

            <label className="admin-span-2">
              <span>Parent product</span>
              <AdminSelectPopup
                title="Parent product"
                value={form.parent_product_id}
                placeholder="None"
                options={[
                  { value: "", label: "None" },
                  ...parentOptions
                    .filter((row) => row.id !== form.id)
                    .map((row) => ({
                      value: row.id,
                      label: `${row.name}${row.sku ? ` · ${row.sku}` : ""}${row.color ? ` · ${row.color}` : ""}`
                    }))
                ]}
                onChange={(parent_product_id) => setForm((f) => ({ ...f, parent_product_id }))}
              />
            </label>

            <label>
              <span>Status</span>
              <AdminSelectPopup
                title="Status"
                value={form.status}
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "pending_approval", label: "Pending approval" },
                  ...(form.status === "rejected"
                    ? [{ value: "rejected", label: "Rejected" }]
                    : []),
                  ...(canApproveProducts
                    ? [
                        { value: "active", label: "Active" },
                        { value: "archived", label: "Archived" }
                      ]
                    : [])
                ]}
                onChange={(status) => setForm((f) => ({ ...f, status }))}
              />
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
              <span>Opening stock</span>
              <input
                type="number"
                min="0"
                value={form.stock_quantity}
                onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
                disabled={Boolean(form.id) || form.is_multicolour}
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
            </label>

            <label className="admin-span-2 admin-check-field">
              <span className="admin-check-row">
                <input
                  type="checkbox"
                  checked={Boolean(form.restock_expected)}
                  onChange={(e) => setForm((f) => ({ ...f, restock_expected: e.target.checked }))}
                />
                <span>Coming soon / restock expected</span>
              </span>
            </label>

            <label className="admin-span-2">
              <span>Short description</span>
              <textarea
                rows={2}
                maxLength={220}
                value={form.short_description}
                onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
              />
            </label>

            <label className="admin-span-2">
              <span>Long description</span>
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
          </div>

          <div className="admin-product-photos" ref={photosRef}>
            <div className="admin-product-photos-head">
              <div>
                <strong>Product photos</strong>
              </div>
              {isCreatedSession ? (
                <button
                  type="button"
                  className="admin-icon-tip admin-image-refresh"
                  disabled={qrRefreshing}
                  onClick={() => void refreshRemoteImages()}
                  data-tooltip={qrRefreshing ? "Refreshing…" : "Refresh phone uploads"}
                  aria-label={qrRefreshing ? "Refreshing…" : "Refresh phone uploads"}
                >
                  <RefreshCw size={16} strokeWidth={2} />
                  <span>{qrRefreshing ? "Refreshing…" : "Refresh phone uploads"}</span>
                </button>
              ) : null}
            </div>

            <div className="admin-image-uploader">
              <div className="admin-barcode-preview-head">
                <strong>Website images (storefront)</strong>
                <span className="muted">
                  {websiteImages.length}/{MAX_KIND_IMAGES}
                </span>
              </div>
              <div className="admin-image-upload-layout">
                <div className={`admin-image-qr-panel${form.image_upload_token ? "" : " is-locked"}`}>
                  {form.image_upload_token && websiteQrDataUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="Scan to upload website photos" src={websiteQrDataUrl} />
                      <span>
                        <QrCode size={12} /> Website QR
                      </span>
                    </>
                  ) : (
                    <>
                      <QrCode size={28} strokeWidth={1.5} />
                    </>
                  )}
                </div>
                <div className="admin-image-grid">
                  {websiteImages.map((image, index) => (
                    <div key={`${image.id || image.preview}-web-${index}`} className="admin-image-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.preview || image.storage_path} alt="" />
                      <button
                        type="button"
                        aria-label="Remove website image"
                        onClick={() => void removeImage(index, "website")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {websiteImages.length < MAX_KIND_IMAGES && (
                    <button
                      type="button"
                      className="admin-image-add"
                      onClick={() => websiteFileRef.current?.click()}
                    >
                      <Upload size={18} />
                      Upload
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={websiteFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                hidden
                onChange={(e) => {
                  void onPickFiles(e.target.files, "website");
                  e.target.value = "";
                }}
              />
            </div>

            <div className="admin-image-uploader">
              <div className="admin-barcode-preview-head">
                <strong>Internal reference images</strong>
                <span className="muted">
                  {internalImages.length}/{MAX_KIND_IMAGES}
                </span>
              </div>
              <div className="admin-image-upload-layout">
                <div className={`admin-image-qr-panel${form.image_upload_token ? "" : " is-locked"}`}>
                  {form.image_upload_token && internalQrDataUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="Scan to upload internal photos" src={internalQrDataUrl} />
                      <span>
                        <QrCode size={12} /> Internal QR
                      </span>
                    </>
                  ) : (
                    <>
                      <QrCode size={28} strokeWidth={1.5} />
                    </>
                  )}
                </div>
                <div className="admin-image-grid">
                  {internalImages.map((image, index) => (
                    <div key={`${image.id || image.preview}-int-${index}`} className="admin-image-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.preview || image.storage_path} alt="" />
                      <button
                        type="button"
                        aria-label="Remove internal image"
                        onClick={() => void removeImage(index, "internal")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {internalImages.length < MAX_KIND_IMAGES && (
                    <button
                      type="button"
                      className="admin-image-add"
                      onClick={() => internalFileRef.current?.click()}
                    >
                      <Upload size={18} />
                      Upload
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={internalFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                hidden
                onChange={(e) => {
                  void onPickFiles(e.target.files, "internal");
                  e.target.value = "";
                }}
              />
            </div>
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
                className="admin-icon-tip admin-action-btn--primary"
                disabled={printBusy}
                onClick={() => void printStickers("pending")}
                data-tooltip={printBusy ? "Printing…" : "Print new stickers"}
                aria-label={printBusy ? "Printing…" : "Print new stickers"}
              >
                <Printer size={16} strokeWidth={2} />
                <span>{printBusy ? "Printing…" : "Print new stickers"}</span>
              </button>
              <button
                type="button"
                className="admin-icon-tip"
                disabled={printBusy}
                onClick={() => void printStickers("all")}
                data-tooltip="Print all unique"
                aria-label="Print all unique stickers"
              >
                <Printer size={16} strokeWidth={2} />
                <span>Print all unique</span>
              </button>
              <button
                type="button"
                className="admin-icon-tip"
                disabled={printBusy}
                onClick={() => void printStickers("family")}
                data-tooltip="Print sample size"
                aria-label="Print sample size stickers"
              >
                <QrCode size={16} strokeWidth={2} />
                <span>Print sample size</span>
              </button>
            </div>
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
            ) : null}
          </div>

          {error ? <AdminAlert>{error}</AdminAlert> : null}

          <div className="admin-product-form-actions">
            <button type="button" className="admin-ghost-btn" onClick={onClose}>
              <X size={15} />
              Cancel
            </button>
            <button className="btn admin-modal-primary" type="submit" disabled={saving}>
              {saving ? (
                "Saving…"
              ) : mode === "create" && !isCreatedSession ? (
                <>
                  <Check size={16} />
                  Create product
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save changes
                </>
              )}
            </button>
          </div>
      </form>
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
    parent_product_id: "",
    price: "",
    compare_at_price: "",
    hsn_code: "5407",
    gst_rate: "5",
    stock_quantity: "0",
    status: "pending_approval",
    short_description: "",
    color: "",
    is_multicolour: false,
    description: "",
    is_featured: false,
    restock_expected: false
  };
}
