"use client";

import { useEffect, useMemo, useState } from "react";
import { PackagePlus, Search, X } from "lucide-react";
import { AdminLoading } from "./admin-ui";
import { useAdminQuery } from "../../hooks/use-admin-query";
import { getAdminUser } from "../../lib/admin-api";

export type ProductPickRow = {
  variant_id: string;
  product_id?: string;
  product_name: string;
  sku: string | null;
  variant_name?: string | null;
  product_color?: string | null;
  is_multicolour?: boolean;
  stock_quantity: number;
};

type InventoryPayload = {
  stock: ProductPickRow[];
};

type Props = {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (row: ProductPickRow) => void;
  onCreateProduct?: () => void;
};

export function ProductPickModal({
  open,
  title = "Select product",
  onClose,
  onSelect,
  onCreateProduct
}: Props) {
  const sessionShopId = getAdminUser()?.shopId || null;
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (!open) {
      setQ("");
      setDebounced("");
      return;
    }
    const t = window.setTimeout(() => setDebounced(q.trim()), 220);
    return () => window.clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const path = useMemo(() => {
    if (!open) return null;
    const params = new URLSearchParams();
    params.set("limit", "60");
    if (sessionShopId) params.set("shopId", sessionShopId);
    if (debounced.length >= 2) params.set("q", debounced);
    return `/api/admin/inventory?${params.toString()}`;
  }, [open, sessionShopId, debounced]);

  const { data, loading } = useAdminQuery<InventoryPayload>(path);

  const rows = useMemo(() => {
    const list = data?.stock || [];
    const term = debounced.toLowerCase();
    if (!term) return list.slice(0, 40);
    return list
      .filter((row) => {
        const hay = [
          row.product_name,
          row.sku,
          row.variant_name,
          row.product_color,
          row.is_multicolour ? "multi-colour" : ""
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(term);
      })
      .slice(0, 40);
  }, [data?.stock, debounced]);

  if (!open) return null;

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="admin-modal grn-sku-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-pick-title"
      >
        <div className="admin-modal-head">
          <div>
            <h2 id="product-pick-title">{title}</h2>
          </div>
          <button type="button" className="admin-modal-close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="grn-sku-modal-body">
          <label className="grn-sku-modal-search">
            <Search size={16} aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, colour, or SKU…"
              autoComplete="off"
            />
          </label>

          <div className="grn-sku-modal-list" role="listbox">
            {loading ? <AdminLoading /> : null}
            {!loading &&
              rows.map((row) => (
                <button
                  key={row.variant_id}
                  type="button"
                  className="grn-sku-modal-option"
                  onClick={() => onSelect(row)}
                >
                  <span className="grn-sku-modal-option-main">
                    <strong>{row.product_name}</strong>
                    <em>{row.is_multicolour ? "Multi-colour" : row.product_color || "—"}</em>
                  </span>
                  <span className="grn-sku-modal-option-side">
                    <span>{row.sku || "no-sku"}</span>
                    <small>On hand {row.stock_quantity}</small>
                  </span>
                </button>
              ))}
            {!loading && !rows.length ? (
              <div className="grn-sku-empty">
                {debounced.length >= 2 ? <p className="muted">No matches</p> : null}
                {debounced.length >= 2 && onCreateProduct ? (
                  <button type="button" className="btn" onClick={onCreateProduct}>
                    <PackagePlus size={14} />
                    Create product
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="admin-modal-actions">
          <button type="button" className="admin-ghost-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
