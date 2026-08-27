import { NextRequest } from "next/server";
import { ok, requirePermission } from "../../../../lib/auth/api";
import { ensureLoyaltySchema, evaluateLoyaltyForCustomer } from "../../../../lib/loyalty";

/** Logged-in customer loyalty snapshot for checkout / account. */
export async function GET(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "orders:own");
  if (error || !ctx) return error;

  await ensureLoyaltySchema();
  const { searchParams } = new URL(request.url);
  const total = Number(searchParams.get("total") || 0);
  const snapshot = await evaluateLoyaltyForCustomer({
    customerId: ctx.userId,
    channel: "online",
    orderTotal: total
  });
  return ok(snapshot);
}
