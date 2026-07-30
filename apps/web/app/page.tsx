import Link from "next/link";
import { ArrivalStatusBar } from "../components/arrival-status-bar";
import { Footer, Header, ProductCard } from "../components/storefront";
import { HeroCarousel } from "../components/hero-carousel";
import { VideoShowcase } from "../components/video-showcase";
import { collections, products } from "../lib/mock-data";

export default function Home() {
  return <><Header />
    <main>
      <HeroCarousel />
      <ArrivalStatusBar />
      <VideoShowcase />
      <section className="shell section" style={{ paddingTop: 0 }}><div className="section-head"><div><div className="eyebrow">Signature edit</div><h2>Saree Collections</h2></div></div><div className="collection-strip">{collections.map((collection) => <Link href="/sarees" key={collection}>{collection}</Link>)}</div></section>
      <section className="shell section"><div className="section-head"><div><div className="eyebrow">The Vasritha edit</div><h2>Chosen for you</h2></div><Link href="/sarees">Shop all →</Link></div><div className="grid">{products.slice(0, 4).map((product) => <ProductCard key={product.slug} product={product} />)}</div></section>
    </main><Footer />
  </>;
}
