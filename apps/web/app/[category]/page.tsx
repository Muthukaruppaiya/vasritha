import { notFound } from "next/navigation";
import { CategoryListing } from "../../components/category-listing";
import { Footer, Header } from "../../components/storefront";
import { categories } from "../../lib/mock-data";

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  return (
    <>
      <Header />
      <main>
        <CategoryListing category={category} />
      </main>
      <Footer />
    </>
  );
}
