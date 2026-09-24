import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission } from "../../../../../lib/auth/api";
import { buildLedger, ensureFinanceSchema } from "../../../../../lib/finance";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "finance:read",
    "reports:finance",
    "dashboard:finance",
    "finance:write"
  ]);
  if (error) return error;

  await ensureFinanceSchema();
  const { searchParams } = new URL(request.url);
  try {
    const data = await buildLedger({
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      q: searchParams.get("q") || undefined
    });
    return ok(data);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to load ledger", 400);
  }
}
