import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../lib/auth/api";
import { query, queryOne } from "../../../lib/db/pool";
import { clientIp, clipText, rateLimit, tooManyRequests } from "../../../lib/security";

export async function POST(request: NextRequest) {
  const limited = rateLimit(`contact:${clientIp(request)}`, 8, 15 * 60 * 1000);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
  } | null;

  if (!body?.name || !body?.email || !body?.message) {
    return fail("name, email and message are required");
  }

  const data = await queryOne(
    `insert into contact_messages (name, email, phone, message, status)
     values ($1, $2, $3, $4, 'new')
     returning id, created_at`,
    [
      clipText(body.name, 120),
      clipText(body.email, 190),
      body.phone ? clipText(body.phone, 20) : null,
      clipText(body.message, 4000)
    ]
  );

  return ok(data, 201);
}

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "customers:support");
  if (error) return error;

  const data = await query(
    `select * from contact_messages order by created_at desc limit 100`
  );
  return ok(data);
}
