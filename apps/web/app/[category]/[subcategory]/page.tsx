import { notFound } from "next/navigation";
import { CategoryListing } from "../../../components/category-listing";
import { Footer, Header } from "../../../components/storefront";
import { getCategoryBySlug, listActiveProducts, listCategories } from "../../../lib/catalog";

export default async function SubcategoryPage({
  params,
  searchParams
}: {
  params: Promise<{ category: string; subcategory: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { category: categorySlug, subcategory: subcategorySlug } = await params;
  const { q = "" } = await searchParams;
  const [category, navCategories] = await Promise.all([
    getCategoryBySlug(categorySlug),
    listCategories()
  ]);
  if (!category) notFound();

  const child = category.subcategories.find((item) => item.slug === subcategorySlug);
  if (!child) notFound();

  const products = await listActiveProducts({
    categorySlug: category.slug,
    subcategorySlug: child.slug,
    q: q.trim() || undefined
  });

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
        <CategoryListing
          category={category}
          products={products}
          activeSubcategorySlug={child.slug}
          searchQuery={q}
        />
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
