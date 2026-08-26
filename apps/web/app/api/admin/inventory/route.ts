import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";
import { ensureGstSchema } from "../../../../lib/gst";

const LOW_STOCK = 10;

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "stock:operate");
  if (error) return error;

  await ensureGstSchema();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const productId = (searchParams.get("product") || "").trim();
  const limitRaw = Number(searchParams.get("limit") || "200");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;

  const [movements, stock] = await Promise.all([
    query(
      `select
         m.id,
         m.product_variant_id,
         m.type,
         m.quantity,
         m.reference_type,
         m.reference_id,
         m.note,
         m.created_by,
         m.created_at,
         pv.sku,
         pv.name as variant_name,
         p.id as product_id,
         p.name as product_name
       from inventory_movements m
       join product_variants pv on pv.id = m.product_variant_id
       join products p on p.id = pv.product_id
       order by m.created_at desc
       limit 80`
    ),
    query(
      `select
         pv.id as variant_id,
         pv.sku,
         pv.name as variant_name,
         pv.attributes,
         pv.stock_quantity,
         p.id as product_id,
         p.name as product_name,
         p.status as product_status,
         p.hsn_code,
         p.gst_rate,
         p.category_id,
         p.subcategory_id,
         c.name as category_name,
         sc.name as subcategory_name
       from product_variants pv
       join products p on p.id = pv.product_id
       left join categories c on c.id = p.category_id
       left join subcategories sc on sc.id = p.subcategory_id
       where (
         $1::text = ''
         or p.name ilike '%' || $1 || '%'
         or coalesce(pv.sku, '') ilike '%' || $1 || '%'
         or coalesce(pv.barcode, '') ilike '%' || $1 || '%'
         or coalesce(p.hsn_code, '') ilike '%' || $1 || '%'
       )
       and ($2::uuid is null or p.id = $2::uuid)
       order by p.name asc, pv.sku asc
       limit ${limit}`,
      [q, productId || null]
    )
  ]);

  const rows = stock as Array<{ stock_quantity: number }>;
  const summary = {
    skuCount: rows.length,
    onHand: rows.reduce((sum, row) => sum + Number(row.stock_quantity || 0), 0),
    inStock: rows.filter((row) => Number(row.stock_quantity) > LOW_STOCK).length,
    lowStock: rows.filter((row) => {
      const qty = Number(row.stock_quantity);
      return qty > 0 && qty <= LOW_STOCK;
    }).length,
    outOfStock: rows.filter((row) => Number(row.stock_quantity) <= 0).length
  };

  return ok({ movements, stock, summary, lowStockThreshold: LOW_STOCK });
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "stock:operate");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    productVariantId?: string;
    type?: "sale" | "return" | "manual_adjustment" | "opening_stock" | "purchase";
    quantity?: number;
    note?: string;
  } | null;

  if (!body?.productVariantId || !body?.type || body.quantity == null) {
    return fail("productVariantId, type and quantity are required");
  }

  if (body.type === "manual_adjustment") {
    const approve = await requirePermission(request, "stock:approve");
    if (approve.error) return approve.error;
  }

  const variant = await queryOne<{ id: string; stock_quantity: number }>(
    `select id, stock_quantity from product_variants where id = $1`,
    [body.productVariantId]
  );
  if (!variant) return fail("Variant not found", 404);

  const current = Number(variant.stock_quantity);
  const absQty = Math.abs(Number(body.quantity));
  let nextQty = current;
  if (body.type === "sale") nextQty = Math.max(0, current - absQty);
  else if (
    body.type === "return" ||
    body.type === "opening_stock" ||
    body.type === "purchase"
  ) {
    nextQty = current + absQty;
  } else nextQty = Math.max(0, current + Number(body.quantity));

  const movementQty =
    body.type === "sale" ? -absQty : body.type === "manual_adjustment" ? Number(body.quantity) : absQty;

  const movement = await queryOne(
    `insert into inventory_movements (product_variant_id, type, quantity, reference_type, note, created_by)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      body.productVariantId,
      body.type,
      movementQty,
      body.type === "purchase" ? "grn" : "manual",
      body.note ?? null,
      ctx.userId
    ]
  );

  await query(`update product_variants set stock_quantity = $2 where id = $1`, [
    body.productVariantId,
    nextQty
  ]);

  // Keep product-level stock in sync for catalogue views
  await query(
    `update products p
     set stock_quantity = coalesce((
       select sum(pv.stock_quantity)::int from product_variants pv where pv.product_id = p.id
     ), 0),
     updated_at = now()
     where p.id = (select product_id from product_variants where id = $1)`,
    [body.productVariantId]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "inventory_movement",
    entityType: "inventory_movements",
    entityId: (movement as { id: string }).id,
    after: movement
  });

  return ok({ movement, stockQuantity: nextQty }, 201);
}
