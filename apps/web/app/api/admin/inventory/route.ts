import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";
import { ensureGstSchema } from "../../../../lib/gst";
import { requireScopedShopId } from "../../../../lib/shop-scope";
import { syncSellableStock } from "../../../../lib/product-units";

const LOW_STOCK = 10;

export async function GET(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "stock:operate");
  if (error || !ctx) return error;

  await ensureGstSchema();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const productId = (searchParams.get("product") || "").trim();
  const preferredShop = searchParams.get("shopId")?.trim() || null;
  const categoryId = (searchParams.get("categoryId") || "").trim();
  const subcategoryId = (searchParams.get("subcategoryId") || "").trim();
  const stockLevel = (searchParams.get("stockLevel") || "").trim(); // in | low | out
  const limitRaw = Number(searchParams.get("limit") || "50");
  const offsetRaw = Number(searchParams.get("offset") || "0");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

  let shopId: string;
  try {
    shopId = (await requireScopedShopId(ctx, preferredShop)).shopId;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No active shop");
  }

  const stockWhere = `
    where (
      $1::text = ''
      or p.name ilike '%' || $1 || '%'
      or coalesce(pv.sku, '') ilike '%' || $1 || '%'
      or coalesce(pv.barcode, '') ilike '%' || $1 || '%'
      or coalesce(p.hsn_code, '') ilike '%' || $1 || '%'
      or coalesce(c.name, '') ilike '%' || $1 || '%'
    )
    and ($2::uuid is null or p.id = $2::uuid)
    and ($4::uuid is null or p.category_id = $4::uuid)
    and ($5::uuid is null or p.subcategory_id = $5::uuid)
    and (
      $6::text = ''
      or ($6 = 'in' and coalesce(svs.stock_quantity, 0) > $7)
      or ($6 = 'low' and coalesce(svs.stock_quantity, 0) > 0 and coalesce(svs.stock_quantity, 0) <= $7)
      or ($6 = 'out' and coalesce(svs.stock_quantity, 0) <= 0)
    )
  `;

  const baseParams = [
    q,
    productId || null,
    shopId,
    categoryId || null,
    subcategoryId || null,
    stockLevel,
    LOW_STOCK
  ];

  const [movements, stock, totalRow, summaryRow] = await Promise.all([
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
         m.shop_id,
         pv.sku,
         pv.name as variant_name,
         p.id as product_id,
         p.name as product_name
       from inventory_movements m
       join product_variants pv on pv.id = m.product_variant_id
       join products p on p.id = pv.product_id
       where m.shop_id = $1
       order by m.created_at desc
       limit 40`,
      [shopId]
    ),
    query(
      `select
         pv.id as variant_id,
         pv.sku,
         pv.name as variant_name,
         pv.attributes,
         coalesce(svs.stock_quantity, 0) as stock_quantity,
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
       left join shop_variant_stock svs
         on svs.variant_id = pv.id and svs.shop_id = $3
       left join categories c on c.id = p.category_id
       left join subcategories sc on sc.id = p.subcategory_id
       ${stockWhere}
       order by p.name asc, pv.sku asc
       limit ${limit} offset ${offset}`,
      baseParams
    ),
    queryOne<{ total: number }>(
      `select count(*)::int as total
       from product_variants pv
       join products p on p.id = pv.product_id
       left join shop_variant_stock svs
         on svs.variant_id = pv.id and svs.shop_id = $3
       left join categories c on c.id = p.category_id
       ${stockWhere}`,
      baseParams
    ),
    // Shop-wide cards (not narrowed by search/page filters)
    queryOne<{
      sku_count: number;
      on_hand: number;
      in_stock: number;
      low_stock: number;
      out_of_stock: number;
    }>(
      `select
         count(*)::int as sku_count,
         coalesce(sum(coalesce(svs.stock_quantity, 0)), 0)::int as on_hand,
         count(*) filter (where coalesce(svs.stock_quantity, 0) > $2)::int as in_stock,
         count(*) filter (
           where coalesce(svs.stock_quantity, 0) > 0
             and coalesce(svs.stock_quantity, 0) <= $2
         )::int as low_stock,
         count(*) filter (where coalesce(svs.stock_quantity, 0) <= 0)::int as out_of_stock
       from product_variants pv
       join products p on p.id = pv.product_id
       left join shop_variant_stock svs
         on svs.variant_id = pv.id and svs.shop_id = $1`,
      [shopId, LOW_STOCK]
    )
  ]);

  const total = Number(totalRow?.total || 0);
  const summary = {
    skuCount: Number(summaryRow?.sku_count || 0),
    onHand: Number(summaryRow?.on_hand || 0),
    inStock: Number(summaryRow?.in_stock || 0),
    lowStock: Number(summaryRow?.low_stock || 0),
    outOfStock: Number(summaryRow?.out_of_stock || 0),
    shopId
  };

  return ok({
    movements,
    stock,
    summary,
    lowStockThreshold: LOW_STOCK,
    shopId,
    total,
    limit,
    offset
  });
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "stock:operate");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    productVariantId?: string;
    type?: "sale" | "return" | "manual_adjustment" | "opening_stock" | "purchase";
    quantity?: number;
    note?: string;
    shopId?: string | null;
  } | null;

  if (!body?.productVariantId || !body?.type || body.quantity == null) {
    return fail("productVariantId, type and quantity are required");
  }

  if (body.type === "manual_adjustment") {
    const approve = await requirePermission(request, "stock:approve");
    if (approve.error) return approve.error;
  }

  let shopId: string;
  try {
    shopId = (await requireScopedShopId(ctx, body.shopId || null)).shopId;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No active shop");
  }

  const variant = await queryOne<{ id: string; product_id: string }>(
    `select id, product_id from product_variants where id = $1`,
    [body.productVariantId]
  );
  if (!variant) return fail("Variant not found", 404);

  const currentRow = await queryOne<{ stock_quantity: number }>(
    `select coalesce(stock_quantity, 0)::int as stock_quantity
     from shop_variant_stock where shop_id = $1 and variant_id = $2`,
    [shopId, body.productVariantId]
  );
  const current = Number(currentRow?.stock_quantity || 0);
  const absQty = Math.abs(Number(body.quantity));
  let nextQty = current;
  if (body.type === "sale") nextQty = Math.max(0, current - absQty);
  else if (
    body.type === "return" ||
    body.type === "opening_stock" ||
    body.type === "purchase"
  ) {
    nextQty = current + absQty;
  } else {
    nextQty = Math.max(0, current + Number(body.quantity));
  }

  const movementQty =
    body.type === "sale"
      ? -absQty
      : body.type === "manual_adjustment"
        ? Number(body.quantity)
        : absQty;

  const movement = await queryOne(
    `insert into inventory_movements
       (product_variant_id, type, quantity, reference_type, note, created_by, shop_id)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      body.productVariantId,
      body.type,
      movementQty,
      body.type === "purchase" ? "grn" : "manual",
      body.note ?? null,
      ctx.userId,
      shopId
    ]
  );

  await query(
    `insert into shop_variant_stock (shop_id, variant_id, stock_quantity, updated_at)
     values ($1, $2, $3, now())
     on conflict (shop_id, variant_id) do update
       set stock_quantity = $3,
           updated_at = now()`,
    [shopId, body.productVariantId, nextQty]
  );

  const pieces = await queryOne<{ c: number }>(
    `select count(*)::int as c from product_items
     where variant_id = $1 and shop_id = $2`,
    [body.productVariantId, shopId]
  );
  if (Number(pieces?.c || 0) > 0) {
    await syncSellableStock({ query, queryOne }, body.productVariantId, shopId);
  } else {
    await query(
      `update product_variants
       set stock_quantity = coalesce((
         select sum(s.stock_quantity)::int from shop_variant_stock s where s.variant_id = $1
       ), 0)
       where id = $1`,
      [body.productVariantId]
    );
  }

  await query(
    `update products p
     set stock_quantity = coalesce((
       select sum(pv.stock_quantity)::int from product_variants pv where pv.product_id = p.id
     ), 0),
     updated_at = now()
     where p.id = $1`,
    [variant.product_id]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "inventory_movement",
    entityType: "inventory_movements",
    entityId: (movement as { id: string }).id,
    after: movement
  });

  return ok({ movement, stockQuantity: nextQty, shopId }, 201);
}
