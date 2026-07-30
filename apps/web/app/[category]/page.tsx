import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header, ProductCard } from "../../components/storefront";
import { categories, products } from "../../lib/mock-data";

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();
  const shown = products.filter((product) => product.category === slug);
  return <><Header /><main>
    <section className="page-head"><div className="shell"><div className="breadcrumbs">Home / {category.name}</div><h1>{category.name}</h1><p className="muted">{category.description}</p></div></section>
    <section className="shell listing"><aside className="filters"><h4>Browse</h4><Link href={`/${slug}`}>All {category.name}</Link>{category.subcategories.map((item) => <Link key={item} href={`/${slug}`}>{item}</Link>)}<h4 style={{ marginTop: 25 }}>Availability</h4><a href="#">In stock</a><a href="#">New arrivals</a></aside><div><div className="section-head"><p className="muted">{shown.length || 0} pieces curated for you</p><span className="muted">Sort: Featured</span></div><div className="products">{shown.map((product) => <ProductCard key={product.slug} product={product} />)}</div>{!shown.length && <div className="panel">Our {category.name.toLowerCase()} edit is being prepared for you.</div>}</div></section>
  </main><Footer /></>;
}
