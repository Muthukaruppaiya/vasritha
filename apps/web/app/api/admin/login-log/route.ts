import { NextRequest } from "next/server";
import { ok, requireAnyPermission } from "../../../../lib/auth/api";
import {
  ensureLoginEventsSchema,
  listLoginEvents,
  loginEventStats
} from "../../../../lib/login-events";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, ["audit:read", "users:manage"]);
  if (error) return error;

  await ensureLoginEventsSchema();
  const { searchParams } = new URL(request.url);
  const [rows, stats] = await Promise.all([
    listLoginEvents({
      q: searchParams.get("q") || undefined,
      client: searchParams.get("client") || "all",
      success: (searchParams.get("success") as "all" | "yes" | "no") || "all",
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      limit: Number(searchParams.get("limit") || 150)
    }),
    loginEventStats()
  ]);

  return ok({ rows, stats });
}
