import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ProductReviews } from "../../../components/product-reviews";
import { Footer, Header } from "../../../components/storefront";
import { products } from "../../../lib/mock-data";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = products.find((item) => item.slug === slug);
  if (!product) notFound();

  return (
    <>
      <Header />
      <main className="shell section">
        <div className="breadcrumbs">Home / {product.category} / {product.name}</div>
        <div className="product-detail">
          <div className="picture product-detail-media">
            <Image src={product.imageSrc} alt={product.name} fill sizes="(max-width: 800px) 100vw, 50vw" />
          </div>
          <div>
            <div className="eyebrow">{product.collection || product.type}</div>
            <h1 className="product-detail-title">{product.name}</h1>
            <div className="price product-detail-price">{product.price}</div>
            <p className="muted product-detail-copy">{product.description}</p>
            <hr className="product-detail-rule" />
            <p className="muted">Hand-selected by Vasritha. Complimentary shipping across India on this piece.</p>
            <Link href="/cart" className="btn">Add to bag</Link>
          </div>
        </div>
        <ProductReviews productSlug={product.slug} />
      </main>
      <Footer />
    </>
  );
}
