import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../../lib/db/pool";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { error } = await requirePermission(request, "products:read");
  if (error) return error;
  const { id } = await params;

  const data = await query(
    `select * from product_images where product_id = $1 order by sort_order asc`,
    [id]
  );
  return ok(data);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;
  const { id: productId } = await params;

  const body = (await request.json().catch(() => null)) as {
    storage_path?: string;
    alt_text?: string;
    sort_order?: number;
  } | null;

  if (!body?.storage_path) return fail("storage_path is required");

  const data = await queryOne(
    `insert into product_images (product_id, storage_path, alt_text, sort_order)
     values ($1, $2, $3, $4)
     returning *`,
    [productId, body.storage_path, body.alt_text ?? null, body.sort_order ?? 0]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "product_images",
    entityId: (data as { id: string }).id,
    after: data
  });
  return ok(data, 201);
}
