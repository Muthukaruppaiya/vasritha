import { ArrivalStatusBar } from "../components/arrival-status-bar";
import { CategoryBanners } from "../components/category-banners";
import { Footer, Header } from "../components/storefront";
import { HeroCarousel } from "../components/hero-carousel";
import { ReviewsSection } from "../components/reviews-section";
import { SareeCollections } from "../components/saree-collections";
import { SpotlightCollections } from "../components/spotlight-collections";
import { VideoShowcase } from "../components/video-showcase";
import { listActiveProducts, listCategories, listCollections } from "../lib/catalog";

const COLLECTION_IMAGES: Record<string, { image: string; lines: string[] }> = {
  "kanchipuram-silk": { image: "/hero-silk.png", lines: ["Kanchipuram", "Silk"] },
  "banarasi-silk": { image: "/catalog-synthetic-saree.png", lines: ["Banarasi", "Silk"] },
  "soft-silk": { image: "/hero-salwar.png", lines: ["Soft", "Silk"] },
  "tussar-silk": { image: "/catalog-cotton-saree.png", lines: ["Tussar", "Silk"] },
  "cotton-weaves": { image: "/catalog-cotton-saree.png", lines: ["Cotton", "Weaves"] }
};

export default async function Home() {
  const [categories, collectionRows, products] = await Promise.all([
    listCategories(),
    listCollections(),
    listActiveProducts({ mode: "card", limit: 16 })
  ]);

  const collections = collectionRows.map((row) => {
    const meta = COLLECTION_IMAGES[row.slug] || {
      image: "/hero-silk.png",
      lines: row.name.split(" ")
    };
    return {
      name: row.name,
      slug: row.slug,
      image: meta.image,
      lines: meta.lines
    };
  });

  const navCategories = categories.map((category) => ({
    slug: category.slug,
    name: category.name,
    description: category.description
  }));

  return (
    <>
      <Header categories={navCategories} />
      <main>
        <HeroCarousel />
        <ArrivalStatusBar />
        <VideoShowcase />
        <CategoryBanners categories={navCategories} />
        <SareeCollections collections={collections} />
        <SpotlightCollections products={products} />
        <ReviewsSection />
      </main>
      <Footer categories={navCategories} />
    </>
  );
}
