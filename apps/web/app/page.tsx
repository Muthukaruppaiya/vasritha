import { ArrivalStatusBar } from "../components/arrival-status-bar";
import { CategoryBanners } from "../components/category-banners";
import { Footer, Header } from "../components/storefront";
import { HeroCarousel } from "../components/hero-carousel";
import { ReviewsSection } from "../components/reviews-section";
import { SareeCollections } from "../components/saree-collections";
import { SpotlightCollections } from "../components/spotlight-collections";
import { VideoShowcase } from "../components/video-showcase";

export default function Home() {
  return <><Header />
    <main>
      <HeroCarousel />
      <ArrivalStatusBar />
      <VideoShowcase />
      <CategoryBanners />
      <SareeCollections />
      <SpotlightCollections />
      <ReviewsSection />
    </main><Footer />
  </>;
}
