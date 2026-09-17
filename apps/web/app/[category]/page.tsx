import { notFound } from "next/navigation";
import { CategoryListing } from "../../components/category-listing";
import { Footer, Header } from "../../components/storefront";
import { getCategoryBySlug, listActiveProducts, listCategories } from "../../lib/catalog";

export default async function CategoryPage({
  params,
  searchParams
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { category: slug } = await params;
  const { q = "" } = await searchParams;
  const [category, navCategories] = await Promise.all([getCategoryBySlug(slug), listCategories()]);
  if (!category) notFound();

  const products = await listActiveProducts({ categorySlug: category.slug });
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? products.filter((product) => {
        const hay = [product.name, product.shortName, product.type, product.sku, product.tag, product.slug]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      })
    : products;

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
        <CategoryListing category={category} products={filtered} searchQuery={q} />
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
