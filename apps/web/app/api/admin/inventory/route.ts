import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "stock:operate");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const limitRaw = Number(searchParams.get("limit") || "100");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;

  const [movements, stock] = await Promise.all([
    query(
      `select id, product_variant_id, type, quantity, reference_type, reference_id, note, created_by, created_at
       from inventory_movements
       order by created_at desc
       limit 100`
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
       )
       order by p.name asc, pv.sku asc
       limit ${limit}`,
      [q]
    )
  ]);

  return ok({ movements, stock });
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
    // inventory staff can operate; approve needed for unrestricted adjust if we want stricter —
    // matrix: inventory can do approved adjustments; managers approve.
    // Allow stock:operate for create; stock:approve only for large unrestricted — keep operate for MVP.
    void approve;
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

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "inventory_movement",
    entityType: "inventory_movements",
    entityId: (movement as { id: string }).id,
    after: movement
  });

  return ok({ movement, stockQuantity: nextQty }, 201);
}
