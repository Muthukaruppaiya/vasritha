import { NextRequest } from "next/server";
import { ok, requireAnyPermission } from "../../../../../lib/auth/api";
import {
  buildProfitAndLoss,
  ensureFinanceSchema,
  listFinanceEntries
} from "../../../../../lib/finance";

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
  const [pnl, recent] = await Promise.all([
    buildProfitAndLoss({ from, to }),
    listFinanceEntries({ limit: 8 })
  ]);

  return ok({
    sync: { inserted: 0 },
    pnl,
    recent,
    cards: {
      net_profit: pnl.net_profit,
      revenue: pnl.revenue,
      incoming: pnl.incoming_total,
      outgoing: pnl.outgoing_total,
      pending_in: pnl.pending_in,
      pending_out: pnl.pending_out
    }
  });
}
