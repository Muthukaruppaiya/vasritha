import { NextRequest } from "next/server";
import { fail, ok, requireAuth, requirePermission, writeAuditLog } from "../../../lib/auth/api";
import { query, queryOne } from "../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const productId = new URL(request.url).searchParams.get("productId");

  const data = await query(
    `select id, product_id, customer_name, rating, body, is_featured, created_at
     from reviews
     where is_approved = true
       and ($1::uuid is null or product_id = $1)
     order by created_at desc
     limit 50`,
    [productId]
  );
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requireAuth(request);
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    productId?: string;
    customerName?: string;
    rating?: number;
    body?: string;
  } | null;

  if (!body?.customerName || !body?.rating || !body?.body) {
    return fail("customerName, rating and body are required");
  }

  const data = await queryOne(
    `insert into reviews (product_id, customer_id, customer_name, rating, body, is_approved, is_featured)
     values ($1, $2, $3, $4, $5, false, false)
     returning *`,
    [body.productId ?? null, ctx.userId, body.customerName, body.rating, body.body]
  );

  return ok(data, 201);
}

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cms:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    reviewId?: string;
    is_approved?: boolean;
    is_featured?: boolean;
  } | null;

  if (!body?.reviewId) return fail("reviewId is required");

  const existing = await queryOne(`select * from reviews where id = $1`, [body.reviewId]);
  if (!existing) return fail("Review not found", 404);

  const data = await queryOne(
    `update reviews
     set is_approved = coalesce($2, is_approved),
         is_featured = coalesce($3, is_featured)
     where id = $1
     returning *`,
    [body.reviewId, body.is_approved ?? null, body.is_featured ?? null]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "moderate",
    entityType: "reviews",
    entityId: body.reviewId,
    after: data
  });
  return ok(data);
}
