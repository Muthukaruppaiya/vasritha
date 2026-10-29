"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminLoading } from "../../../../components/admin/admin-ui";
import {
  blankProductForm,
  ProductForm,
  type ProductFormCategory,
  type ProductFormValues,
  type ProductParentOption
} from "../../../../components/admin/product-form";
import { useAdminQuery } from "../../../../hooks/use-admin-query";

type Category = ProductFormCategory;
type ProductRow = {
  id: string;
  name: string;
  sku?: string | null;
  color?: string | null;
  parent_product_id?: string | null;
  category_id?: string;
  subcategory_id?: string | null;
  is_multicolour?: boolean;
  label_size?: "accessory" | "dress";
  short_name?: string | null;
};

export default function AdminNewProductPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminNewProductPageInner />
    </Suspense>
  );
}

function AdminNewProductPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromGrn = searchParams.get("fromGrn") === "1";
  const editGrnId = searchParams.get("editGrn") || "";
  const parentId = searchParams.get("parent") || "";

  const { data: categories, loading: categoriesLoading } = useAdminQuery<Category[]>(
    "/api/admin/categories"
  );
  const { data: products, loading: productsLoading } = useAdminQuery<ProductRow[]>(
    "/api/admin/products?limit=200"
  );

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

  useEffect(() => {
    if (!categories?.length) return;
    const base = blankProductForm(categories[0]?.id || "");
    if (!parentId) {
      setInitial(base);
      return;
    }
    const parent = (products || []).find((row) => row.id === parentId);
    if (!parent && productsLoading) return;
    if (!parent) {
      setInitial(base);
      return;
    }
    setInitial({
      ...base,
      category_id: parent.category_id || base.category_id,
      subcategory_id: parent.subcategory_id || "",
      parent_product_id: parent.id,
      color: parent.is_multicolour ? "" : parent.color || "",
      is_multicolour: Boolean(parent.is_multicolour),
      label_size: parent.label_size === "accessory" ? "accessory" : "dress",
      name: `${parent.name} · design`,
      short_name: parent.short_name || ""
    });
  }, [categories, parentId, products, productsLoading]);

  const goBack = () => {
    if (fromGrn) {
      const edit = editGrnId ? `&editGrn=${encodeURIComponent(editGrnId)}` : "";
      window.location.href = `/admin/inventory/grn?resumeGrn=1${edit}`;
      return;
    }
    router.push("/admin/products");
  };

  if (categoriesLoading || !initial) {
    return <AdminLoading />;
  }

  return (
    <ProductForm
      mode="create"
      categories={categories || []}
      parentOptions={parentOptions}
      initial={initial}
      onClose={goBack}
      onSaved={(created) => {
        if (fromGrn) {
          const variant = created?.defaultVariantId
            ? `&newVariant=${encodeURIComponent(created.defaultVariantId)}`
            : "";
          const edit = editGrnId ? `&editGrn=${encodeURIComponent(editGrnId)}` : "";
          window.location.href = `/admin/inventory/grn?resumeGrn=1${variant}${edit}`;
          return;
        }
        if (created?.id) {
          router.replace(`/admin/products/${created.id}/edit`);
          return;
        }
        router.push("/admin/products");
      }}
    />
  );
}
