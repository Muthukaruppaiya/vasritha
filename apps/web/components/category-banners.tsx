import Image from "next/image";
import Link from "next/link";
import { categoryBanners } from "../lib/mock-data";

function ShopNowBadge({ brand, slug }: { brand: string; slug: string }) {
  const arcId = `cat-arc-${slug}`;

  return (
    <span className="cat-banner-cta" aria-hidden="true">
      <svg className="cat-banner-arc" viewBox="0 0 120 120">
        <defs>
          <path id={arcId} d="M 18,60 A 42,42 0 0 1 102,60" />
        </defs>
        <text>
          <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
            {`COLLECTION BY ${brand.toUpperCase()}`}
          </textPath>
        </text>
      </svg>
      <span className="cat-banner-shop">Shop Now</span>
    </span>
  );
}

export function CategoryBanners() {
  return (
    <section className="category-banners">
      <div className="shell category-banners-head" data-reveal>
        <div className="eyebrow">Shop by category</div>
        <h2>Every room of the boutique</h2>
      </div>

      <div className="category-banner-list">
        {categoryBanners.map((banner, index) => (
          <Link
            key={banner.slug}
            href={banner.href}
            className={`cat-banner cat-banner--${banner.tone}`}
            data-reveal
            data-reveal-delay={String(Math.min(index + 1, 5))}
          >
            <span className="cat-banner-panel">
              <span className="cat-banner-brand">{banner.brand}</span>
              <span className="cat-banner-title">
                {banner.titleLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </span>
              <ShopNowBadge brand={banner.brand} slug={banner.slug} />
            </span>

            <span className="cat-banner-media">
              <Image
                src={banner.image}
                alt={banner.titleLines.join(" ")}
                fill
                sizes="(max-width:800px) 100vw, 55vw"
              />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
