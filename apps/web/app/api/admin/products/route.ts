import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";
import { emptyToNull, subcategoryBelongsToCategory } from "../../../../lib/db/taxonomy";

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
       p.price, p.compare_at_price, p.status, p.stock_quantity, p.is_featured,
       p.category_id, p.subcategory_id, p.created_at, p.updated_at,
       c.name as category_name,
       sc.name as subcategory_name,
       img.storage_path as primary_image,
       (
         select count(*)::int from product_items pi_count
         where pi_count.product_id = p.id
       ) as unit_count
     from products p
     left join categories c on c.id = p.category_id
     left join subcategories sc on sc.id = p.subcategory_id
     left join lateral (
       select pi.storage_path
       from product_images pi
       where pi.product_id = p.id
       order by pi.sort_order asc
       limit 1
     ) img on true
     where ($1::text is null or p.status::text = $1)
     order by p.created_at desc
     limit ${limit} offset ${offset}`,
    [status]
  );
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;

  await ensureProductUnitsSchema();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.name || !body?.slug || !body?.category_id || body.price == null) {
    return fail("name, slug, category_id and price are required");
  }

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

  const data = await queryOne<{
    id: string;
    image_upload_token: string;
    price: string;
  }>(
    `insert into products
       (name, slug, sku, barcode, tag, sku_prefix, label_size, category_id, subcategory_id,
        short_name, short_description, color, description,
        price, compare_at_price, status, stock_quantity, is_featured)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
      body.status ? String(body.status) : "draft",
      0,
      Boolean(body.is_featured ?? body.fast_selling)
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
}
