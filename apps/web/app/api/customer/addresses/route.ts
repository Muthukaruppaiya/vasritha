import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "addresses:own");
  if (error || !ctx) return error;

  const data = await query(
    `select * from addresses where customer_id = $1 order by is_default desc`,
    [ctx.userId]
  );
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "addresses:own");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.recipient_name || !body?.phone || !body?.line1 || !body?.city || !body?.state || !body?.postal_code) {
    return fail("recipient_name, phone, line1, city, state and postal_code are required");
  }

  const data = await queryOne(
    `insert into addresses (customer_id, label, recipient_name, phone, line1, line2, city, state, postal_code, country, is_default)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning *`,
    [
      ctx.userId,
      body.label ?? null,
      body.recipient_name,
      body.phone,
      body.line1,
      body.line2 ?? null,
      body.city,
      body.state,
      body.postal_code,
      body.country ?? "India",
      Boolean(body.is_default)
    ]
  );

  return ok(data, 201);
}
