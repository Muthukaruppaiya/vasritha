import { NextRequest } from "next/server";
import {
  fail,
  ok,
  requireAnyPermission,
  requirePermission,
  writeAuditLog
} from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";
import { emptyToNull, subcategoryBelongsToCategory } from "../../../../../lib/db/taxonomy";
import { listProductItems, ensureProductUnitsSchema, recordPriceHistory } from "../../../../../lib/product-units";
import { ensureGstSchema, normalizeGstRate, normalizeHsn } from "../../../../../lib/gst";
import { ensureBrandsSchema, resolveBrandId } from "../../../../../lib/brands";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_FIELDS = [
  "name",
  "slug",
  "sku",
  "barcode",
  "tag",
  "sku_prefix",
  "label_size",
  "short_name",
  "short_description",
  "color",
  "description",
  "category_id",
  "subcategory_id",
  "price",
  "compare_at_price",
  "status",
  "is_featured",
  "parent_product_id",
  "hsn_code",
  "gst_rate",
  "brand_id"
] as const;

export async function GET(request: NextRequest, { params }: Params) {
  const { error } = await requirePermission(request, "products:read");
  if (error) return error;

  await ensureProductUnitsSchema();
  await ensureGstSchema();

  const { id } = await params;

  const product = await queryOne(`select * from products where id = $1`, [id]);
  if (!product) return fail("Product not found", 404);

  const [variants, images, items, children, parent] = await Promise.all([
    query(`select * from product_variants where product_id = $1`, [id]),
    query(
      `select *, image_kind::text as image_kind
       from product_images where product_id = $1
       order by image_kind asc, sort_order asc`,
      [id]
    ),
    listProductItems(id).catch(() => []),
    query(
      `select id, name, sku, color, stock_quantity, status, price
       from products where parent_product_id = $1
       order by name asc`,
      [id]
    ),
    (product as { parent_product_id?: string | null }).parent_product_id
      ? queryOne<{ id: string; name: string; sku: string | null }>(
          `select id, name, sku from products where id = $1`,
          [(product as { parent_product_id: string }).parent_product_id]
        )
      : Promise.resolve(null)
  ]);

  const websiteImages = images.filter(
    (row) => (row as { image_kind?: string }).image_kind !== "internal"
  );
  const internalImages = images.filter(
    (row) => (row as { image_kind?: string }).image_kind === "internal"
  );

  return ok({
    ...product,
    product_variants: variants,
    product_images: websiteImages,
    internal_images: internalImages,
    product_items: items,
    child_products: children,
    parent_product: parent
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;

  await ensureGstSchema();

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail("Invalid body");

  if ("price" in body || "compare_at_price" in body) {
    const pricingAuth = await requireAnyPermission(request, [
      "pricing:manage",
      "pricing:limited"
    ]);
    if (pricingAuth.error) return pricingAuth.error;
  }

  if ("hsn_code" in body) {
    const hsn = body.hsn_code == null || String(body.hsn_code).trim() === ""
      ? null
      : normalizeHsn(body.hsn_code);
    if (body.hsn_code != null && String(body.hsn_code).trim() && !hsn) {
      return fail("HSN code must be 4 to 8 digits");
    }
    body.hsn_code = hsn;
  }
  if ("gst_rate" in body) {
    body.gst_rate = normalizeGstRate(body.gst_rate, 5);
  }
  if ("brand_id" in body) {
    await ensureBrandsSchema();
    body.brand_id = await resolveBrandId(
      body.brand_id == null || String(body.brand_id).trim() === ""
        ? null
        : String(body.brand_id)
    );
  }

  const before = await queryOne<{
    id: string;
    price: string;
    category_id: string;
    subcategory_id: string | null;
  }>(`select * from products where id = $1`, [id]);
  if (!before) return fail("Product not found", 404);

  const updates: string[] = [];
  const values: unknown[] = [];
  const normalized = { ...body };
  if ("fast_selling" in normalized && !("is_featured" in normalized)) {
    normalized.is_featured = Boolean(normalized.fast_selling);
  }
  if ("subcategory_id" in normalized) {
    normalized.subcategory_id = emptyToNull(normalized.subcategory_id);
  }

  const nextCategoryId = String(normalized.category_id ?? before.category_id);
  if ("category_id" in normalized && !("subcategory_id" in normalized)) {
    const currentSub = before.subcategory_id ?? null;
    if (!(await subcategoryBelongsToCategory(nextCategoryId, currentSub))) {
      normalized.subcategory_id = null;
    }
  }
  const nextSubcategoryId =
    "subcategory_id" in normalized
      ? (normalized.subcategory_id as string | null)
      : (before.subcategory_id ?? null);
  if (!(await subcategoryBelongsToCategory(nextCategoryId, nextSubcategoryId))) {
    return fail("Subcategory must belong to the selected category");
  }

  if ("parent_product_id" in normalized) {
    normalized.parent_product_id = emptyToNull(normalized.parent_product_id);
    const parentId = normalized.parent_product_id as string | null;
    if (parentId) {
      if (parentId === id) return fail("A product cannot be its own parent");
      const parent = await queryOne<{ id: string; parent_product_id: string | null }>(
        `select id, parent_product_id from products where id = $1`,
        [parentId]
      );
      if (!parent) return fail("Parent product not found", 404);
      if (parent.parent_product_id) {
        return fail("Choose a top-level product as parent (not another child design)");
      }
      const hasChildren = await queryOne<{ c: number }>(
        `select count(*)::int as c from products where parent_product_id = $1`,
        [id]
      );
      if (Number(hasChildren?.c || 0) > 0) {
        return fail("This product already has child designs; clear those first before nesting it");
      }
    }
  }

  for (const key of ALLOWED_FIELDS) {
    if (key in normalized) {
      values.push(normalized[key]);
      updates.push(`${key} = $${values.length}`);
    }
  }
  updates.push("updated_at = now()");

  values.push(id);
  const data = await queryOne<{
    id: string;
    sku: string | null;
    barcode: string | null;
    price: string;
    stock_quantity: number;
  }>(
    `update products set ${updates.join(", ")} where id = $${values.length} returning *`,
    values
  );

  if (data && (data.sku || "sku" in (body || {}))) {
    const sku = data.sku || `VAS-${data.id.slice(0, 8)}`;
    const barcode = data.barcode || sku.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const existing = await queryOne<{ id: string }>(
      `select id from product_variants where product_id = $1 order by name asc limit 1`,
      [id]
    );
    if (existing) {
      await query(
        `update product_variants
         set sku = $2, barcode = $3, price = $4
         where id = $1`,
        [existing.id, sku, barcode, Number(data.price)]
      );
    } else {
      await query(
        `insert into product_variants (product_id, name, sku, barcode, price, stock_quantity, attributes)
         values ($1, 'Default', $2, $3, $4, 0, '{}'::jsonb)`,
        [id, sku, barcode, Number(data.price)]
      );
    }
  }

  if (data && "price" in (body || {}) && Number(data.price) !== Number(before.price)) {
    await recordPriceHistory(id, Number(data.price));
  }

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "products",
    entityId: id,
    before,
    after: data
  });

  return ok(data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;

  const { id } = await params;

  const before = await queryOne(`select * from products where id = $1`, [id]);
  if (!before) return fail("Product not found", 404);

  await query(`update products set status = 'archived', updated_at = now() where id = $1`, [id]);

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "archive",
    entityType: "products",
    entityId: id,
    before
  });

  return ok({ id, status: "archived" });
}
