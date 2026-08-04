import { NextRequest } from "next/server";
import { ok, requirePermission } from "../../../../lib/auth/api";
import { query } from "../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "audit:read");
  if (error) return error;

  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50);

  const data = await query(
    `select * from audit_logs order by created_at desc limit $1`,
    [Math.min(limit, 200)]
  );
  return ok(data);
}
