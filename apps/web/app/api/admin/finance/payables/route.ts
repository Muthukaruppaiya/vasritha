import { NextRequest } from "next/server";
import { ok, requireAnyPermission } from "../../../../../lib/auth/api";
import { ensureFinanceSchema } from "../../../../../lib/finance";
import { listPayables } from "../../../../../lib/finance-reports";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "finance:read",
    "reports:finance",
    "finance:write"
  ]);
  if (error) return error;
  await ensureFinanceSchema();
  const { searchParams } = new URL(request.url);
  const rows = await listPayables({
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    q: searchParams.get("q") || undefined
  });
  const ageing = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  let outstanding = 0;
  for (const row of rows.filter((r) => r.outstanding_amount > 0)) {
    outstanding += row.outstanding_amount;
    ageing[row.ageing as keyof typeof ageing] += row.outstanding_amount;
  }
  return ok({
    rows,
    totals: {
      outstanding,
      count: rows.filter((r) => r.outstanding_amount > 0).length,
      ageing
    }
  });
}
