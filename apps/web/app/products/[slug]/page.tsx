import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ProductPurchase } from "../../../components/product-purchase";
import { ProductReviews } from "../../../components/product-reviews";
import { Footer, Header, ProductCard } from "../../../components/storefront";
import { categories, products } from "../../../lib/mock-data";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = products.find((item) => item.slug === slug);
  if (!product) notFound();

  const category = categories.find((item) => item.slug === product.category);
  const categoryLabel = category?.name ?? "collection";
  const related = products
    .filter((item) => item.category === product.category && item.slug !== product.slug)
    .slice(0, 4);

  return (
    <>
      <Header />
      <main className="product-page">
        <section className="shell product-page-inner">
          <nav className="product-crumbs" data-reveal="fade" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href={`/${product.category}`}>{categoryLabel}</Link>
            <span>/</span>
            <span>{product.shortName}</span>
          </nav>

          <div className="product-detail">
            <div className="product-detail-media" data-reveal="left">
              <Image
                src={product.imageSrc}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 800px) 100vw, 50vw"
              />
            </div>

            <div className="product-detail-info" data-reveal="right" data-reveal-delay="1">
              <div className="eyebrow">{product.collection || product.type}</div>
              <p className="product-detail-short">{product.shortName}</p>
              <h1 className="product-detail-title">{product.name}</h1>

              <div className="product-detail-pricing">
                <span className="product-detail-price">{product.price}</span>
                {product.compareAtPrice && (
                  <span className="product-detail-compare">{product.compareAtPrice}</span>
                )}
              </div>

              <p className="product-detail-copy">{product.description}</p>

              <ul className="product-detail-perks">
                <li>Hand-selected by Vasritha</li>
                <li>Complimentary shipping across India</li>
                <li>Thoughtful packing for gifting</li>
              </ul>

              <ProductPurchase product={product} categoryLabel={categoryLabel} />
            </div>
          </div>

          {related.length > 0 && (
            <section className="product-related" data-reveal>
              <div className="product-related-head">
                <div>
                  <div className="eyebrow">You may also love</div>
                  <h2>More from this edit</h2>
                </div>
                <Link href={`/${product.category}`}>View all →</Link>
              </div>
              <div className="products product-related-grid">
                {related.map((item, index) => (
                  <div key={item.slug} data-reveal data-reveal-delay={String(index + 1)}>
                    <ProductCard product={item} variant="listing" />
                  </div>
                ))}
              </div>
            </section>
          )}

          <div data-reveal>
            <ProductReviews productSlug={product.slug} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
