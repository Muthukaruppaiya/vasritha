import { NextRequest } from "next/server";
import { cachedOk, fail } from "../../../../lib/auth/api";
import { getProductBySlug, listRelatedProducts } from "../../../../lib/catalog";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const includeRelated = new URL(request.url).searchParams.get("related") !== "0";
  const product = await getProductBySlug(slug);
  if (!product) return fail("Product not found", 404);

  const related = includeRelated
    ? await listRelatedProducts(product.category, product.slug, 4)
    : [];

  return cachedOk({ product, related });
}
