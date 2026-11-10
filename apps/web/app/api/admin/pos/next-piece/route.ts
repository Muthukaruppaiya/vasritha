import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../../lib/auth/api";
import { ensurePosSchema, nextSellablePiece } from "../../../../../lib/pos";
import { requireScopedShopId } from "../../../../../lib/shop-scope";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "pos:create");
  if (error || !ctx) return error;

  await ensurePosSchema();

  const { searchParams } = new URL(request.url);
  const productId = String(searchParams.get("productId") || "").trim();
  const variantId = String(searchParams.get("variantId") || "").trim() || null;
  if (!UUID_RE.test(productId)) return fail("productId is required");
  if (variantId && !UUID_RE.test(variantId)) return fail("Invalid variantId");

  const excludeItemIds = String(searchParams.get("exclude") || "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => UUID_RE.test(id));

  const preferredShop = searchParams.get("shopId")?.trim() || null;
  const scoped = await requireScopedShopId(ctx, preferredShop);

  const piece = await nextSellablePiece({
    productId,
    variantId,
    shopId: scoped.shopId,
    excludeItemIds
  });
  return ok({ piece });
}
