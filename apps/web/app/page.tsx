import Link from "next/link";
import { ArrivalStatusBar } from "../components/arrival-status-bar";
import { Footer, Header, ProductCard } from "../components/storefront";
import { HeroCarousel } from "../components/hero-carousel";
import { ReviewsSection } from "../components/reviews-section";
import { SareeCollections } from "../components/saree-collections";
import { VideoShowcase } from "../components/video-showcase";
import { products } from "../lib/mock-data";

export default function Home() {
  return <><Header />
    <main>
      <HeroCarousel />
      <ArrivalStatusBar />
      <VideoShowcase />
      <SareeCollections />
      <section className="shell section"><div className="section-head"><div><div className="eyebrow">The Vasritha edit</div><h2>Chosen for you</h2></div><Link href="/sarees">Shop all →</Link></div><div className="grid">{products.slice(0, 4).map((product) => <ProductCard key={product.slug} product={product} />)}</div></section>
      <ReviewsSection />
    </main><Footer />
  </>;
}
