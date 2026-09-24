import { NextRequest } from "next/server";
import { ok, requireAnyPermission } from "../../../../../lib/auth/api";
import { ensureFinanceSchema } from "../../../../../lib/finance";
import { getFinanceSettings } from "../../../../../lib/finance-accounts";
import { buildFinanceDashboard } from "../../../../../lib/finance-reports";

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
  const settings = await getFinanceSettings();
  const data = await buildFinanceDashboard({
    period: searchParams.get("period") || "this_month",
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    fyStartMonth: settings.fy_start_month
  });
  return ok(data);
}
