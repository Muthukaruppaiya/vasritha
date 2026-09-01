import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";
import { emptyToNull, subcategoryBelongsToCategory } from "../../../../lib/db/taxonomy";
import {
  createUnitsAndSync,
  ensureProductUnitsSchema,
  recordPriceHistory
} from "../../../../lib/product-units";
import { ensureGstSchema, normalizeGstRate, normalizeHsn } from "../../../../lib/gst";
import { ensureBrandsSchema, resolveBrandId } from "../../../../lib/brands";
import { resolveMediaUrl } from "../../../../lib/product-image-storage";

async function upsertDefaultVariant(input: {
  productId: string;
  sku: string;
  barcode: string | null;
  price: number;
  stock: number;
}) {
  const existing = await queryOne<{ id: string }>(
    `select id from product_variants where product_id = $1 order by name asc limit 1`,
    [input.productId]
  );

  if (existing) {
    return queryOne<{ id: string }>(
      `update product_variants
       set sku = $2, barcode = $3, price = $4, stock_quantity = $5
       where id = $1
       returning *`,
      [existing.id, input.sku, input.barcode, input.price, input.stock]
    );
  }

  return queryOne<{ id: string }>(
    `insert into product_variants (product_id, name, sku, barcode, price, stock_quantity, attributes)
     values ($1, 'Default', $2, $3, $4, $5, '{}'::jsonb)
     returning *`,
    [input.productId, input.sku, input.barcode, input.price, input.stock]
  );
}

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "products:read");
  if (error) return error;

  await ensureProductUnitsSchema();
  await ensureGstSchema();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limitRaw = Number(searchParams.get("limit") || "100");
  const offsetRaw = Number(searchParams.get("offset") || "0");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

  const data = await query(
    `select
       p.id, p.name, p.slug, p.sku, p.barcode, p.tag, p.sku_prefix, p.label_size,
       p.short_name, p.short_description, p.color, p.description,
       p.price, p.compare_at_price, p.hsn_code, p.gst_rate, p.status, p.stock_quantity, p.is_featured,
       p.category_id, p.subcategory_id, p.parent_product_id, p.created_at, p.updated_at,
       c.name as category_name,
       sc.name as subcategory_name,
       parent.name as parent_name,
       parent.sku as parent_sku,
       img.storage_path as primary_image,
       (
         select count(*)::int from product_items pi_count
         where pi_count.product_id = p.id
       ) as unit_count,
       (
         select count(*)::int from products children
         where children.parent_product_id = p.id
       ) as child_count
     from products p
     left join categories c on c.id = p.category_id
     left join subcategories sc on sc.id = p.subcategory_id
     left join products parent on parent.id = p.parent_product_id
     left join lateral (
       select pi.storage_path
       from product_images pi
       where pi.product_id = p.id
         and coalesce(pi.image_kind::text, 'website') = 'website'
       order by pi.sort_order asc
       limit 1
     ) img on true
     where ($1::text is null or p.status::text = $1)
     order by p.created_at desc
     limit ${limit} offset ${offset}`,
    [status]
  );
  return ok(
    data.map((row) => ({
      ...row,
      primary_image: row.primary_image ? resolveMediaUrl(String(row.primary_image)) : null
    }))
  );
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;

  try {
    await ensureProductUnitsSchema();
    await ensureGstSchema();
    await ensureBrandsSchema();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body?.name || !body?.slug || !body?.category_id || body.price == null) {
      return fail("name, slug, category_id and price are required");
    }

    const hsnCode = normalizeHsn(body.hsn_code);
    if (body.hsn_code != null && String(body.hsn_code).trim() && !hsnCode) {
      return fail("HSN code must be 4 to 8 digits");
    }
    const gstRate = normalizeGstRate(body.gst_rate, 5);

    const skuPrefix = String(body.sku_prefix || "VAS")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 8) || "VAS";
    const sku =
      (body.sku ? String(body.sku).trim().toUpperCase() : "") ||
      `${skuPrefix}-${Date.now().toString().slice(-8)}`;
    const familyBarcode = sku.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16);
    const tag = (body.tag ? String(body.tag).trim() : "") || sku;
    const labelSize = body.label_size === "accessory" ? "accessory" : "dress";
    const subcategoryId = emptyToNull(body.subcategory_id);
    if (!(await subcategoryBelongsToCategory(String(body.category_id), subcategoryId))) {
      return fail("Subcategory must belong to the selected category");
    }
    const stock = body.stock_quantity != null ? Math.max(0, Math.trunc(Number(body.stock_quantity))) : 0;

    // Optional parent for Case 2 (design children). Case 1 leaves this null.
    let parentProductId: string | null = emptyToNull(body.parent_product_id);
    if (parentProductId) {
      const parent = await queryOne<{ id: string; parent_product_id: string | null }>(
        `select id, parent_product_id from products where id = $1`,
        [parentProductId]
      );
      if (!parent) return fail("Parent product not found", 404);
      if (parent.parent_product_id) {
        return fail("Choose a top-level product as parent (not another child design)");
      }
    }

    const brandId = await resolveBrandId(
      body.brand_id != null ? String(body.brand_id) : null
    );

    const data = await queryOne<{
      id: string;
      image_upload_token: string;
      price: string;
    }>(
      `insert into products
         (name, slug, sku, barcode, tag, sku_prefix, label_size, category_id, subcategory_id,
          short_name, short_description, color, description,
          price, compare_at_price, hsn_code, gst_rate, status, stock_quantity, is_featured, parent_product_id, brand_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       returning *`,
      [
        String(body.name),
        String(body.slug),
        sku,
        familyBarcode,
        tag.toUpperCase(),
        skuPrefix,
        labelSize,
        String(body.category_id),
        subcategoryId,
        body.short_name ? String(body.short_name).trim() : "",
        body.short_description ? String(body.short_description) : "",
        body.color ? String(body.color).trim() : "",
        body.description ? String(body.description) : "",
        Number(body.price),
        body.compare_at_price != null ? Number(body.compare_at_price) : null,
        hsnCode,
        gstRate,
        body.status ? String(body.status) : "draft",
        0,
        Boolean(body.is_featured ?? body.fast_selling),
        parentProductId,
        brandId
      ]
    );

    if (!data) return fail("Could not create product", 500);

    const variant = await upsertDefaultVariant({
      productId: data.id,
      sku,
      barcode: familyBarcode,
      price: Number(body.price),
      stock: 0
    });

    let items: unknown[] = [];
    if (variant?.id && stock > 0) {
      items = await createUnitsAndSync({
        productId: data.id,
        variantId: variant.id,
        tag: tag.toUpperCase(),
        sku,
        count: stock
      });
    }

    await recordPriceHistory(data.id, Number(body.price));

    const created = await queryOne(`select * from products where id = $1`, [data.id]);

    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "create",
      entityType: "products",
      entityId: data.id,
      after: { ...created, units_created: items.length }
    });

    return ok({ ...created, product_items: items }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Product create failed";
    console.error("[admin/products POST]", message);
    if (/column .* does not exist|relation .* does not exist/i.test(message)) {
      return fail(
        "Database schema is out of date on this server. Run npm run db:patch:vercel-products against production Postgres, then retry.",
        500
      );
    }
    if (/duplicate key|unique constraint/i.test(message)) {
      return fail("SKU, barcode, or slug already exists. Use a unique code.", 409);
    }
    return fail(message, 500);
  }
}
