"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Printer, X } from "lucide-react";
import { AdminBadge, AdminLoading, statusTone } from "./admin-ui";
import { adminFetch, formatDate, formatMoney } from "../../lib/admin-api";
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

type ProductDetail = {
  id: string;
  name: string;
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
  status: string;
  stock_quantity: number;
  category_name?: string | null;
  created_at?: string;
  product_images?: Array<{ id: string; storage_path: string; image_kind?: string }>;
  internal_images?: Array<{ id: string; storage_path: string; image_kind?: string }>;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!productId) {
      setData(null);
      setSelectedId(null);
      return;
    }
    setLoading(true);
    setError("");
    void adminFetch<ProductDetail>(`/api/admin/products/${productId}`).then((result) => {
      setLoading(false);
      if (result.error || !result.data) {
        setError(result.error || "Could not load product");
        setData(null);
        return;
      }
      setData(result.data);
      setSelectedId(result.data.product_items?.[0]?.id || null);
    });
  }, [productId]);

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

  if (!productId) return null;

  const items = data?.product_items || [];
  const image = data?.product_images?.[0]?.storage_path;
  const websiteGallery = data?.product_images || [];
  const internalGallery = data?.internal_images || [];

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
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="admin-detail-photo" />
                ) : null}
                {websiteGallery.length > 1 || internalGallery.length > 0 ? (
                  <div className="admin-detail-galleries">
                    {websiteGallery.length > 1 ? (
                      <div>
                        <h3>Website images</h3>
                        <div className="admin-detail-thumbs">
                          {websiteGallery.map((row) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={row.id} src={row.storage_path} alt="" />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {internalGallery.length ? (
                      <div>
                        <h3>Internal reference</h3>
                        <div className="admin-detail-thumbs">
                          {internalGallery.map((row) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={row.id} src={row.storage_path} alt="" />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <dl className="admin-detail-dl">
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
                    <dd>{formatMoney(data.price)}</dd>
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
                    <dt>Status</dt>
                    <dd>
                      <AdminBadge tone={statusTone(data.status)}>{data.status}</AdminBadge>
                    </dd>
                  </div>
                  <div>
                    <dt>Label size</dt>
                    <dd>{data.label_size === "accessory" ? "Accessory (small)" : "Dress / saree"}</dd>
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
                {data.short_description ? <p>{data.short_description}</p> : null}
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
                          printProductStickers({
                            price: data.price,
                            labelSize: data.label_size === "accessory" ? "accessory" : "dress",
                            items: list
                          });
                          const ids = list.map((item) => item.id);
                          void adminFetch(`/api/admin/products/${data.id}/items`, {
                            method: "PATCH",
                            json: { itemIds: ids, label_printed: true }
                          }).then(() => {
                            setData((current) =>
                              current
                                ? {
                                    ...current,
                                    product_items: (current.product_items || []).map((item) =>
                                      ids.includes(item.id) ? { ...item, label_printed: true } : item
                                    )
                                  }
                                : current
                            );
                          });
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
                      onClick={() =>
                        printProductStickers({
                          price: data.price,
                          labelSize: data.label_size === "accessory" ? "accessory" : "dress",
                          items: [selected]
                        })
                      }
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
