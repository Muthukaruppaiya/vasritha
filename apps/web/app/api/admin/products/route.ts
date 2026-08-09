import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

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
    return queryOne(
      `update product_variants
       set sku = $2, barcode = $3, price = $4, stock_quantity = $5
       where id = $1
       returning *`,
      [existing.id, input.sku, input.barcode, input.price, input.stock]
    );
  }

  return queryOne(
    `insert into product_variants (product_id, name, sku, barcode, price, stock_quantity, attributes)
     values ($1, 'Default', $2, $3, $4, $5, '{}'::jsonb)
     returning *`,
    [input.productId, input.sku, input.barcode, input.price, input.stock]
  );
}

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "products:read");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limitRaw = Number(searchParams.get("limit") || "100");
  const offsetRaw = Number(searchParams.get("offset") || "0");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

  const data = await query(
    `select
       p.id, p.name, p.slug, p.sku, p.barcode, p.short_name, p.short_description, p.color, p.description,
       p.price, p.compare_at_price, p.status, p.stock_quantity, p.is_featured,
       p.category_id, p.subcategory_id, p.created_at, p.updated_at,
       c.name as category_name,
       img.storage_path as primary_image
     from products p
     left join categories c on c.id = p.category_id
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

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.name || !body?.slug || !body?.category_id || body.price == null) {
    return fail("name, slug, category_id and price are required");
  }

  const sku =
    (body.sku ? String(body.sku).trim() : "") ||
    `VAS-${Date.now().toString().slice(-8)}`;
  const barcode =
    (body.barcode ? String(body.barcode).trim() : "") ||
    sku.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16);

  const data = await queryOne<{ id: string }>(
    `insert into products
       (name, slug, sku, barcode, category_id, subcategory_id, short_name, short_description, color, description,
        price, compare_at_price, status, stock_quantity, is_featured)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     returning *`,
    [
      String(body.name),
      String(body.slug),
      sku,
      barcode,
      String(body.category_id),
      body.subcategory_id ? String(body.subcategory_id) : null,
      body.short_name ? String(body.short_name).trim() : "",
      body.short_description ? String(body.short_description) : "",
      body.color ? String(body.color).trim() : "",
      body.description ? String(body.description) : "",
      Number(body.price),
      body.compare_at_price != null ? Number(body.compare_at_price) : null,
      body.status ? String(body.status) : "draft",
      body.stock_quantity != null ? Number(body.stock_quantity) : 0,
      Boolean(body.is_featured ?? body.fast_selling)
    ]
  );

  if (!data) return fail("Could not create product", 500);

  await upsertDefaultVariant({
    productId: data.id,
    sku,
    barcode,
    price: Number(body.price),
    stock: body.stock_quantity != null ? Number(body.stock_quantity) : 0
  });

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "products",
    entityId: data.id,
    after: data
  });

  return ok(data, 201);
}
