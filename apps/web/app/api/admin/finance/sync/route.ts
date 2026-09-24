import { NextRequest } from "next/server";
import { ok, requireAnyPermission } from "../../../../../lib/auth/api";
import { ensureFinanceSchema, syncAllFinanceSources } from "../../../../../lib/finance";

export async function POST(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "finance:write",
    "finance:read",
    "reports:finance",
    "dashboard:finance"
  ]);
  if (error) return error;

  await ensureFinanceSchema();
  const result = await syncAllFinanceSources(300);
  return ok(result);
}
