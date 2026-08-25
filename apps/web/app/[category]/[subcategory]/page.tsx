import { notFound } from "next/navigation";
import { CategoryListing } from "../../../components/category-listing";
import { Footer, Header } from "../../../components/storefront";
import { getCategoryBySlug, listActiveProducts, listCategories } from "../../../lib/catalog";

export default async function SubcategoryPage({
  params
}: {
  params: Promise<{ category: string; subcategory: string }>;
}) {
  const { category: categorySlug, subcategory: subcategorySlug } = await params;
  const [category, navCategories] = await Promise.all([
    getCategoryBySlug(categorySlug),
    listCategories()
  ]);
  if (!category) notFound();

  const child = category.subcategories.find((item) => item.slug === subcategorySlug);
  if (!child) notFound();

  const products = await listActiveProducts({
    categorySlug: category.slug,
    subcategorySlug: child.slug
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
