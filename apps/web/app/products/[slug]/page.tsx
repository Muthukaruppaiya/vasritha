import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Footer, Header } from "../../../components/storefront";
import { products } from "../../../lib/mock-data";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = products.find((item) => item.slug === slug);
  if (!product) notFound();
  return <><Header /><main className="shell section"><div className="breadcrumbs">Home / {product.category} / {product.name}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 55, marginTop: 28 }}><div className="picture" style={{ height: 530 }}><Image src={product.imageSrc} alt={product.name} fill sizes="(max-width: 800px) 100vw, 50vw" /></div><div><div className="eyebrow">{product.collection || product.type}</div><h1 style={{ font: "500 3.3rem var(--font-heading),serif", margin: "12px 0" }}>{product.name}</h1><div className="price" style={{ fontSize: "1.2rem" }}>{product.price}</div><p className="muted" style={{ marginTop: 25 }}>{product.description}</p><hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "28px 0" }} /><p className="muted">Hand-selected by Vasritha. Complimentary shipping across India on this piece.</p><Link href="/cart" className="btn">Add to bag</Link></div></div></main><Footer /></>;
}
