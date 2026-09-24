import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission } from "../../../../../lib/auth/api";
import { buildProfitAndLoss, ensureFinanceSchema } from "../../../../../lib/finance";

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
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  try {
    const data = await buildProfitAndLoss({ from, to });
    return ok(data);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to build P&L", 400);
  }
}
