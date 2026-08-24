import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../../lib/db/pool";
import { ensureProductUnitsSchema, listProductItems } from "../../../../../../lib/product-units";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { error } = await requirePermission(request, "products:read");
  if (error) return error;
  const { id } = await params;
  await ensureProductUnitsSchema();
  const product = await queryOne(`select id, name, sku, tag, label_size, price from products where id = $1`, [id]);
  if (!product) return fail("Product not found", 404);
  const items = await listProductItems(id);
  return ok({ product, items });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    itemIds?: string[];
    label_printed?: boolean;
  } | null;
  const ids = (body?.itemIds || []).filter(Boolean);
  if (!ids.length) return fail("itemIds required");

  await query(
    `update product_items set label_printed = $2 where product_id = $1 and id = any($3::uuid[])`,
    [id, Boolean(body?.label_printed), ids]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "product_items",
    entityId: id,
    after: { itemIds: ids, label_printed: Boolean(body?.label_printed) }
  });

  return ok({ updated: ids.length });
}
