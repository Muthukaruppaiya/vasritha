"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminAlert, AdminLoading } from "../../../../../components/admin/admin-ui";
import {
  ProductForm,
  type ProductFormCategory,
  type ProductFormImage,
  type ProductFormValues,
  type ProductParentOption
} from "../../../../../components/admin/product-form";
import { adminFetch } from "../../../../../lib/admin-api";
import { useAdminQuery } from "../../../../../hooks/use-admin-query";

type Category = ProductFormCategory;
type ProductRow = {
  id: string;
  name: string;
  sku?: string | null;
  color?: string | null;
  parent_product_id?: string | null;
};

type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  sku?: string | null;
  barcode?: string | null;
  tag?: string | null;
  sku_prefix?: string | null;
  label_size?: "accessory" | "dress";
  image_upload_token?: string;
  category_id: string;
  subcategory_id?: string | null;
  parent_product_id?: string | null;
  price?: number | null;
  purchase_price?: number | null;
  compare_at_price?: number | null;
  hsn_code?: string | null;
  gst_rate?: number | null;
  stock_quantity?: number | null;
  status: string;
  short_name?: string | null;
  short_description?: string | null;
  color?: string | null;
  is_multicolour?: boolean;
  description?: string | null;
  is_featured?: boolean;
  restock_expected?: boolean;
  product_images?: Array<{ id: string; storage_path: string }>;
  internal_images?: Array<{ id: string; storage_path: string }>;
};

export default function AdminEditProductPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminEditProductPageInner />
    </Suspense>
  );
}

function AdminEditProductPageInner() {
  const router = useRouter();
  const params = useParams();
  const productId = String(params.id || "");

  const { data: categories, loading: categoriesLoading } = useAdminQuery<Category[]>(
    "/api/admin/categories"
  );
  const { data: products } = useAdminQuery<ProductRow[]>("/api/admin/products?limit=200");

  const parentOptions = useMemo<ProductParentOption[]>(() => {
    return (products || [])
      .filter((row) => !row.parent_product_id)
      .map((row) => ({
        id: row.id,
        name: row.name,
        sku: row.sku,
        color: row.color
      }));
  }, [products]);

  const [initial, setInitial] = useState<ProductFormValues | null>(null);
  const [images, setImages] = useState<ProductFormImage[]>([]);
  const [internalImages, setInternalImages] = useState<ProductFormImage[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      const result = await adminFetch<ProductDetail>(`/api/admin/products/${productId}`);
      if (cancelled) return;
      if (result.error || !result.data) {
        setError(result.error || "Product not found");
        setLoading(false);
        return;
      }
      const product = result.data;
      setInitial({
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku || `VAS-${product.id.slice(0, 8).toUpperCase()}`,
        barcode:
          product.barcode ||
          (product.sku || `VAS${product.id.slice(0, 8)}`).replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
        tag: product.tag || product.sku || "",
        sku_prefix: product.sku_prefix || "VAS",
        label_size: product.label_size === "accessory" ? "accessory" : "dress",
        image_upload_token: product.image_upload_token,
        category_id: product.category_id,
        subcategory_id: product.subcategory_id || "",
        parent_product_id: product.parent_product_id || "",
        price: String(product.price ?? ""),
        purchase_price: product.purchase_price != null ? String(product.purchase_price) : "",
        compare_at_price: product.compare_at_price ? String(product.compare_at_price) : "",
        hsn_code: product.hsn_code || "",
        gst_rate: String(product.gst_rate ?? 5),
        stock_quantity: String(product.stock_quantity ?? 0),
        status: product.status,
        short_name: product.short_name || "",
        short_description: product.short_description || "",
        color: product.color || "",
        is_multicolour: Boolean(product.is_multicolour),
        description: product.description || "",
        is_featured: Boolean(product.is_featured),
        restock_expected: Boolean(product.restock_expected)
      });
      setImages(
        (product.product_images || []).map((image) => ({
          id: image.id,
          storage_path: image.storage_path,
          kind: "website" as const
        }))
      );
      setInternalImages(
        (product.internal_images || []).map((image) => ({
          id: image.id,
          storage_path: image.storage_path,
          kind: "internal" as const
        }))
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (loading || categoriesLoading || !initial) {
    return (
      <div className="admin-stack">
        {error ? <AdminAlert>{error}</AdminAlert> : <AdminLoading />}
      </div>
    );
  }

  return (
    <ProductForm
      mode="edit"
      categories={categories || []}
      parentOptions={parentOptions}
      initial={initial}
      initialImages={images}
      initialInternalImages={internalImages}
      onClose={() => router.push("/admin/products")}
      onSaved={() => {
        /* stay on edit page */
      }}
    />
  );
}
