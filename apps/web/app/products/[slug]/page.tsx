import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalizedProductDetail } from "../../../components/localized-product-detail";
import { ProductReviews } from "../../../components/product-reviews";
import { Footer, Header } from "../../../components/storefront";
import { getProductBySlug, listActiveProducts } from "../../../lib/catalog";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = (await listActiveProducts({ categorySlug: product.category }))
    .filter((item) => item.slug !== product.slug)
    .slice(0, 4);

  return (
    <>
      <Header />
      <main className="product-page">
        <LocalizedProductDetail product={product} related={related} />
        <section className="shell" data-reveal>
          <ProductReviews productSlug={product.slug} />
        </section>
      </main>
      <Footer />
    </>
  );
}
