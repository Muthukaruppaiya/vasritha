import { NextRequest } from "next/server";
import { ok, requireAnyPermission } from "../../../../lib/auth/api";
import { query } from "../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "customers:search",
    "customers:support",
    "customers:manage"
  ]);
  if (error) return error;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? null;
  const like = q ? `%${q}%` : null;

  const data = await query(
    `select id, full_name, email, phone, created_at
     from customers
     where ($1::text is null or full_name ilike $1 or email ilike $1 or phone ilike $1)
     order by created_at desc
     limit 50`,
    [like]
  );
  return ok(data);
}
