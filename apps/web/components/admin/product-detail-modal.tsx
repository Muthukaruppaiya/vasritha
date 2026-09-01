"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { Printer, Upload, X } from "lucide-react";
import { AdminBadge, AdminLoading, statusTone } from "./admin-ui";
import { adminFetch, formatDate, formatMoney, getAdminToken } from "../../lib/admin-api";
import { buildProductUploadPageUrl } from "../../lib/product-upload-url";
import { categoryImage } from "../../lib/category-images";
import { printProductStickers } from "../../lib/print-stickers";

type ProductItem = {
  id: string;
  tag: string;
  seq: number;
  unit_code: string;
  barcode: string;
  status: string;
  damage_detail: string | null;
  date_added: string;
  date_sold: string | null;
  bill_id: string | null;
  label_printed: boolean;
};

type ProductImage = { id: string; storage_path: string; image_kind?: string };

type ProductDetail = {
  id: string;
  name: string;
  short_name?: string | null;
  slug: string;
  sku: string | null;
  barcode: string | null;
  tag?: string | null;
  sku_prefix?: string | null;
  label_size?: "accessory" | "dress";
  color?: string | null;
  short_description?: string | null;
  description?: string | null;
  price: string;
  compare_at_price?: string | null;
  hsn_code?: string | null;
  gst_rate?: string | number | null;
  status: string;
  stock_quantity: number;
  is_featured?: boolean;
  category_name?: string | null;
  subcategory_name?: string | null;
  category_slug?: string | null;
  created_at?: string;
  image_upload_token?: string;
  product_images?: ProductImage[];
  internal_images?: ProductImage[];
  product_items?: ProductItem[];
  parent_product?: { id: string; name: string; sku: string | null } | null;
  child_products?: Array<{
    id: string;
    name: string;
    sku: string | null;
    color: string | null;
    stock_quantity: number;
    status: string;
  }>;
};

export function ProductDetailModal({
  productId,
  onClose,
  onEdit
}: {
  productId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
}) {
  const [data, setData] = useState<ProductDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const reload = async () => {
    if (!productId) return;
    setLoading(true);
    setError("");
    const result = await adminFetch<ProductDetail>(`/api/admin/products/${productId}`);
    setLoading(false);
    if (result.error || !result.data) {
      setError(result.error || "Could not load product");
      setData(null);
      return;
    }
    setData(result.data);
    setSelectedId((current) => current || result.data!.product_items?.[0]?.id || null);
  };

  useEffect(() => {
    if (!productId) {
      setData(null);
      setSelectedId(null);
      setQrDataUrl("");
      return;
    }
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    if (!data?.image_upload_token) {
      setQrDataUrl("");
      return;
    }
    const url = buildProductUploadPageUrl(data.image_upload_token, window.location.origin);
    void QRCode.toDataURL(url, { margin: 1, width: 140 }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [data?.image_upload_token]);

  const selected = data?.product_items?.find((item) => item.id === selectedId) || null;

  useEffect(() => {
    if (!barcodeRef.current || !selected?.barcode) return;
    try {
      JsBarcode(barcodeRef.current, selected.barcode, {
        format: "CODE128",
        width: 2,
        height: 56,
        displayValue: true,
        fontSize: 12,
        margin: 4
      });
    } catch {
      // ignore invalid
    }
  }, [selected?.barcode]);

  const onUploadWebsitePhoto = async (files: FileList | null) => {
    if (!data || !files?.length) return;
    setUploadBusy(true);
    setError("");
    try {
      for (const file of Array.from(files).slice(0, 5 - (data.product_images?.length || 0))) {
        const body = new FormData();
        body.append("file", file);
        body.append("kind", "website");
        const token = getAdminToken();
        const res = await fetch(`/api/admin/products/${data.id}/images`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body
        });
        const payload = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(payload.error || "Upload failed");
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  if (!productId) return null;

  const items = data?.product_items || [];
  const websiteGallery = data?.product_images || [];
  const internalGallery = data?.internal_images || [];
  const heroImage = websiteGallery[0]?.storage_path || categoryImage(data?.category_slug || "sarees");
  const hasUploadedPhoto = Boolean(websiteGallery[0]?.storage_path);

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-modal admin-modal--wide"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-modal-head">
          <div>
            <p className="eyebrow">Product details</p>
            <h2>{data?.name || "Product"}</h2>
            {data?.short_name && data.short_name !== data.name ? (
              <p className="muted">{data.short_name}</p>
            ) : null}
          </div>
          <button type="button" className="admin-modal-close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="admin-modal-body">
          {loading ? <AdminLoading /> : null}
          {error ? <p className="admin-alert admin-alert--error">{error}</p> : null}

          {data ? (
            <div className="admin-detail-grid">
              <div className="admin-detail-main">
                <div className="admin-detail-photo-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroImage}
                    alt={data.name}
                    className={`admin-detail-photo${hasUploadedPhoto ? "" : " admin-detail-photo--placeholder"}`}
                  />
                  {!hasUploadedPhoto ? (
                    <p className="muted admin-field-hint">
                      Category placeholder shown. Upload a real photo below for the website.
                    </p>
                  ) : null}
                  {websiteGallery.length > 1 ? (
                    <div className="admin-detail-thumbs">
                      {websiteGallery.map((row) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={row.id} src={row.storage_path} alt="" />
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="admin-detail-upload-row">
                  <button
                    type="button"
                    className="btn"
                    disabled={uploadBusy || websiteGallery.length >= 5}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Upload size={14} />
                    {uploadBusy ? "Uploading…" : "Upload website photo"}
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    hidden
                    onChange={(e) => void onUploadWebsitePhoto(e.target.files)}
                  />
                  {data.image_upload_token && qrDataUrl ? (
                    <div className="admin-detail-qr">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrDataUrl} alt="Scan to upload from phone" />
                      <span>Phone QR</span>
                    </div>
                  ) : null}
                </div>

                {internalGallery.length ? (
                  <div className="admin-detail-galleries">
                    <div>
                      <h3>Internal reference</h3>
                      <div className="admin-detail-thumbs">
                        {internalGallery.map((row) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={row.id} src={row.storage_path} alt="" />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                <dl className="admin-detail-dl">
                  <div>
                    <dt>Category</dt>
                    <dd>
                      {data.category_name || "—"}
                      {data.subcategory_name ? ` · ${data.subcategory_name}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>SKU / family code</dt>
                    <dd>{data.sku || "—"}</dd>
                  </div>
                  <div>
                    <dt>Connecting tag</dt>
                    <dd>{data.tag || data.sku || "—"}</dd>
                  </div>
                  <div>
                    <dt>Price</dt>
                    <dd>
                      {formatMoney(data.price)}
                      {data.compare_at_price ? (
                        <span className="muted"> · MRP {formatMoney(data.compare_at_price)}</span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>Stock (unique pieces)</dt>
                    <dd>{data.stock_quantity}</dd>
                  </div>
                  <div>
                    <dt>Colour</dt>
                    <dd>{data.color || "—"}</dd>
                  </div>
                  <div>
                    <dt>HSN / GST</dt>
                    <dd>
                      {data.hsn_code || "—"} · {data.gst_rate != null ? `${data.gst_rate}%` : "5%"}
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <AdminBadge tone={statusTone(data.status)}>{data.status}</AdminBadge>
                      {data.is_featured ? <span className="muted"> · Featured</span> : null}
                    </dd>
                  </div>
                  <div>
                    <dt>Label size</dt>
                    <dd>{data.label_size === "accessory" ? "Accessory (small)" : "Dress / saree"}</dd>
                  </div>
                  <div>
                    <dt>Slug</dt>
                    <dd>{data.slug}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDate(data.created_at)}</dd>
                  </div>
                  {data.parent_product ? (
                    <div>
                      <dt>Parent product</dt>
                      <dd>
                        {data.parent_product.name}
                        {data.parent_product.sku ? ` · ${data.parent_product.sku}` : ""}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {data.short_description ? (
                  <p className="admin-detail-lead">{data.short_description}</p>
                ) : null}
                {data.description ? <p className="admin-detail-desc">{data.description}</p> : null}

                {data.child_products && data.child_products.length > 0 ? (
                  <div className="admin-detail-children">
                    <h3>Design children ({data.child_products.length})</h3>
                    <ul>
                      {data.child_products.map((child) => (
                        <li key={child.id}>
                          {child.name}
                          {child.sku ? ` · ${child.sku}` : ""}
                          {child.color ? ` · ${child.color}` : ""}
                          {" · "}
                          {child.stock_quantity} pcs
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="admin-detail-units">
                <div className="admin-detail-units-head">
                  <div>
                    <h3>Unique barcodes</h3>
                    <p className="muted">Each piece has its own number. Click one to see details.</p>
                  </div>
                  {items.length ? (
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        className="admin-action-btn admin-action-btn--primary"
                        onClick={() => {
                          const pending = items.filter(
                            (item) =>
                              (!item.status || item.status === "to_sell") && !item.label_printed
                          );
                          const list = pending.length
                            ? pending
                            : items.filter((item) => !item.status || item.status === "to_sell");
                          if (!list.length || !data) return;
                          const ids = list.map((item) => item.id);
                          void printProductStickers({
                            price: data.price,
                            labelSize: data.label_size === "accessory" ? "accessory" : "dress",
                            meta: {
                              productName: data.name,
                              categoryName: data.category_name || undefined,
                              sku: data.sku,
                              color: data.color,
                              tag: data.tag,
                              compareAtPrice: data.compare_at_price
                            },
                            items: list.map((item) => ({
                              ...item,
                              tag: item.tag,
                              seq: item.seq,
                              sizeLabel: data.color
                            }))
                          })
                            .then(() =>
                              adminFetch(`/api/admin/products/${data.id}/items`, {
                                method: "PATCH",
                                json: { itemIds: ids, label_printed: true }
                              })
                            )
                            .then(() => void reload());
                        }}
                      >
                        <Printer size={14} />
                        <span>Print barcodes</span>
                      </button>
                    </div>
                  ) : null}
                </div>
                {items.length ? (
                  <div className="admin-unit-chips">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={item.id === selectedId ? "is-active" : ""}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <strong>{item.unit_code}</strong>
                        <span>{item.barcode}</span>
                        <em>{item.status.replace("_", " ")}</em>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No unique pieces yet. Set stock on create or inward stock.</p>
                )}

                {selected ? (
                  <div className="admin-piece-card">
                    <h4>Piece {selected.seq}</h4>
                    <svg ref={barcodeRef} />
                    <dl className="admin-detail-dl">
                      <div>
                        <dt>Unique code</dt>
                        <dd>{selected.unit_code}</dd>
                      </div>
                      <div>
                        <dt>Barcode number</dt>
                        <dd>{selected.barcode}</dd>
                      </div>
                      <div>
                        <dt>Tag</dt>
                        <dd>{selected.tag}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{selected.status.replace("_", " ")}</dd>
                      </div>
                      <div>
                        <dt>Added</dt>
                        <dd>{formatDate(selected.date_added)}</dd>
                      </div>
                      <div>
                        <dt>Sold</dt>
                        <dd>{selected.date_sold ? formatDate(selected.date_sold) : "—"}</dd>
                      </div>
                      <div>
                        <dt>Label</dt>
                        <dd>{selected.label_printed ? "Printed" : "Not printed"}</dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        if (!data || !selected) return;
                        void printProductStickers({
                          price: data.price,
                          labelSize: data.label_size === "accessory" ? "accessory" : "dress",
                          meta: {
                            productName: data.name,
                            categoryName: data.category_name || undefined,
                            sku: data.sku,
                            color: data.color,
                            tag: data.tag,
                            compareAtPrice: data.compare_at_price
                          },
                          items: [
                            {
                              ...selected,
                              tag: selected.tag,
                              seq: selected.seq,
                              sizeLabel: data.color
                            }
                          ]
                        });
                      }}
                    >
                      <Printer size={14} />
                      Print this sticker
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="admin-modal-actions">
            <button type="button" className="admin-ghost-btn" onClick={onClose}>
              Close
            </button>
            {data ? (
              <button type="button" className="btn" onClick={() => onEdit(data.id)}>
                Edit product
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
