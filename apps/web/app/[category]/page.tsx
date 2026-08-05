import { notFound } from "next/navigation";
import { CategoryListing } from "../../components/category-listing";
import { Footer, Header } from "../../components/storefront";
import { getCategoryBySlug, listActiveProducts } from "../../lib/catalog";

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const products = await listActiveProducts({ categorySlug: category.slug });

  return (
    <>
      <Header />
      <main>
        <CategoryListing category={category} products={products} />
      </main>
      <Footer />
    </>
  );
}
