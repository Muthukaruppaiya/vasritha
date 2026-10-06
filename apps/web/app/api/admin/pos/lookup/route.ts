import { NextRequest } from "next/server";
import { ok, requirePermission } from "../../../../../lib/auth/api";
import { ensurePosSchema, lookupSellable } from "../../../../../lib/pos";
import { requireScopedShopId } from "../../../../../lib/shop-scope";

export async function GET(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "pos:create");
  if (error || !ctx) return error;

  await ensurePosSchema();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  if (!q) return ok([]);

  const preferredShop = searchParams.get("shopId")?.trim() || null;
  const scoped = await requireScopedShopId(ctx, preferredShop);

  const data = await lookupSellable(q, scoped.shopId);
  return ok(data);
}
