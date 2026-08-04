import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "products:read");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const data = await query(
    `select
       p.id, p.name, p.slug, p.description, p.price, p.compare_at_price, p.status,
       p.stock_quantity, p.category_id, p.subcategory_id, p.created_at, p.updated_at,
       c.name as category_name
     from products p
     left join categories c on c.id = p.category_id
     where ($1::text is null or p.status::text = $1)
     order by p.created_at desc`,
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

  const data = await queryOne(
    `insert into products (name, slug, category_id, subcategory_id, description, price, compare_at_price, status, stock_quantity)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      String(body.name),
      String(body.slug),
      String(body.category_id),
      body.subcategory_id ? String(body.subcategory_id) : null,
      body.description ? String(body.description) : "",
      Number(body.price),
      body.compare_at_price != null ? Number(body.compare_at_price) : null,
      body.status ? String(body.status) : "draft",
      body.stock_quantity != null ? Number(body.stock_quantity) : 0
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "products",
    entityId: (data as { id: string }).id,
    after: data
  });

  return ok(data, 201);
}
