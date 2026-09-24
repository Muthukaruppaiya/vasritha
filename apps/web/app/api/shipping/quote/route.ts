import { NextRequest } from "next/server";
import { fail, ok } from "../../../../lib/auth/api";
import { quoteShipping } from "../../../../lib/shipping";

export const dynamic = "force-dynamic";

function parseIdList(raw: string | null) {
  if (!raw) return [] as string[];
  return Array.from(
    new Set(
      raw
        .split(/[,;\s]+/)
        .map((id) => id.trim())
        .filter(Boolean)
    )
  );
}

/**
 * Public shipping quote for cart / checkout.
 * Order create re-runs the same logic — this is display + gate only.
 * Optional product_ids / category_ids drive category-based rates.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subtotal = Math.max(0, Number(searchParams.get("subtotal") || 0));
    const postalCode =
      searchParams.get("postal_code") ||
      searchParams.get("pincode") ||
      searchParams.get("pin") ||
      undefined;
    const productIds = parseIdList(
      searchParams.get("product_ids") || searchParams.get("productIds")
    );
    const categoryIds = parseIdList(
      searchParams.get("category_ids") || searchParams.get("categoryIds")
    );

    const quote = await quoteShipping({
      subtotal,
      postalCode,
      productIds,
      categoryIds
    });
    return ok(quote);
  } catch (err) {
    console.error("[shipping/quote]", err);
    return fail("Could not calculate shipping", 500);
  }
}
