import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission } from "../../../../../lib/auth/api";
import { ensureLoginEventsSchema, getLoginEvent } from "../../../../../lib/login-events";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { error } = await requireAnyPermission(request, ["audit:read", "users:manage"]);
  if (error) return error;

  await ensureLoginEventsSchema();
  const { id } = await params;
  const row = await getLoginEvent(id);
  if (!row) return fail("Login event not found", 404);
  return ok(row);
}
