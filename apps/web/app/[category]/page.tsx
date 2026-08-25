import { notFound } from "next/navigation";
import { CategoryListing } from "../../components/category-listing";
import { Footer, Header } from "../../components/storefront";
import { getCategoryBySlug, listActiveProducts, listCategories } from "../../lib/catalog";

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const [category, navCategories] = await Promise.all([getCategoryBySlug(slug), listCategories()]);
  if (!category) notFound();

  const products = await listActiveProducts({ categorySlug: category.slug });

  return (
    <>
      <Header
        categories={navCategories.map((item) => ({
          slug: item.slug,
          name: item.name,
          description: item.description,
          nameI18n: item.nameI18n
        }))}
      />
      <main>
        <CategoryListing category={category} products={products} />
      </main>
      <Footer
        categories={navCategories.map((item) => ({
          slug: item.slug,
          name: item.name,
          nameI18n: item.nameI18n
        }))}
      />
    </>
  );
}
