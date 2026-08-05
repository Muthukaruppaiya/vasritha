import { NextRequest } from "next/server";
import { fail, ok } from "../../../../lib/auth/api";
import { getProductBySlug, listActiveProducts } from "../../../../lib/catalog";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const product = await getProductBySlug(slug);
  if (!product) return fail("Product not found", 404);

  const related = (await listActiveProducts({ categorySlug: product.category }))
    .filter((item) => item.slug !== product.slug)
    .slice(0, 4);

  return ok({ product, related });
}
