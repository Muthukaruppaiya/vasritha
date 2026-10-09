import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../../lib/auth/api";
import { ensurePosSchema, listPosColourOptions } from "../../../../../lib/pos";
import { requireScopedShopId } from "../../../../../lib/shop-scope";

export async function GET(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "pos:create");
  if (error || !ctx) return error;

  await ensurePosSchema();

  const { searchParams } = new URL(request.url);
  const productId = String(searchParams.get("productId") || "").trim();
  const variantId = String(searchParams.get("variantId") || "").trim() || null;
  if (!productId) return fail("productId is required");

  const preferredShop = searchParams.get("shopId")?.trim() || null;
  const scoped = await requireScopedShopId(ctx, preferredShop);

  const colours = await listPosColourOptions(productId, variantId, scoped.shopId);
  return ok({ colours });
}
