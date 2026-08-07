import { notFound } from "next/navigation";
import { LocalizedProductDetail } from "../../../components/localized-product-detail";
import { ProductReviews } from "../../../components/product-reviews";
import { Footer, Header } from "../../../components/storefront";
import { getProductBySlug, listRelatedProducts } from "../../../lib/catalog";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await listRelatedProducts(product.category, product.slug, 4);

  return (
    <>
      <Header />
      <main className="product-page">
        <LocalizedProductDetail product={product} related={related} />
        <section className="shell" data-reveal>
          <ProductReviews
            productId={product.id}
            productSlug={product.slug}
            productName={product.name}
          />
        </section>
      </main>
      <Footer />
    </>
  );
}
