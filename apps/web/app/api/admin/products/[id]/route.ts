import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";
import { emptyToNull, subcategoryBelongsToCategory } from "../../../../../lib/db/taxonomy";

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
  "is_featured"
] as const;

export async function GET(request: NextRequest, { params }: Params) {
  const { error } = await requirePermission(request, "products:read");
  if (error) return error;

  const { id } = await params;

  const product = await queryOne(`select * from products where id = $1`, [id]);
  if (!product) return fail("Product not found", 404);

  const [variants, images, items] = await Promise.all([
    query(`select * from product_variants where product_id = $1`, [id]),
    query(`select * from product_images where product_id = $1 order by sort_order asc`, [id]),
    listProductItems(id).catch(() => [])
  ]);

  return ok({ ...product, product_variants: variants, product_images: images, product_items: items });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail("Invalid body");

  const before = await queryOne<{ id: string; price: string }>(`select * from products where id = $1`, [id]);
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

  const nextCategoryId = String(
    normalized.category_id ?? (before as { category_id: string }).category_id
  );
  if ("category_id" in normalized && !("subcategory_id" in normalized)) {
    const currentSub = (before as { subcategory_id?: string | null }).subcategory_id ?? null;
    if (!(await subcategoryBelongsToCategory(nextCategoryId, currentSub))) {
      normalized.subcategory_id = null;
    }
  }
  const nextSubcategoryId =
    "subcategory_id" in normalized
      ? (normalized.subcategory_id as string | null)
      : ((before as { subcategory_id?: string | null }).subcategory_id ?? null);
  if (!(await subcategoryBelongsToCategory(nextCategoryId, nextSubcategoryId))) {
    return fail("Subcategory must belong to the selected category");
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
