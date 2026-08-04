import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../../lib/db/pool";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { error } = await requirePermission(request, "products:read");
  if (error) return error;
  const { id } = await params;

  const data = await query(
    `select * from product_variants where product_id = $1 order by name asc`,
    [id]
  );
  return ok(data);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;
  const { id: productId } = await params;

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    sku?: string;
    barcode?: string;
    price?: number;
    stock_quantity?: number;
    attributes?: Record<string, string>;
  } | null;

  if (!body?.name || !body?.sku || body.price == null) {
    return fail("name, sku and price are required");
  }

  const data = await queryOne(
    `insert into product_variants (product_id, name, sku, price, stock_quantity, attributes)
     values ($1, $2, $3, $4, $5, $6::jsonb)
     returning *`,
    [
      productId,
      body.name,
      body.sku,
      body.price,
      body.stock_quantity ?? 0,
      JSON.stringify(body.attributes ?? {})
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "product_variants",
    entityId: (data as { id: string }).id,
    after: data
  });

  return ok(data, 201);
}
