"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useT } from "../lib/i18n/provider";
import type { MessageKey } from "../lib/i18n/translate";

const FALLBACK_IMAGES: Record<string, string> = {
  sarees: "/hero-silk.png",
  jewelry: "/hero-jewelry.png",
  "churidhars-salwars": "/hero-salwar.png",
  handcrafted: "/catalog-brass-idol.png"
};

const TONES = ["brown", "wine", "clay", "umber"] as const;

const TITLE_KEYS: Record<string, [MessageKey, MessageKey]> = {
  sarees: ["home.titleSarees1", "home.titleSarees2"],
  jewelry: ["home.titleJewelry1", "home.titleJewelry2"],
  "churidhars-salwars": ["home.titleCasual1", "home.titleCasual2"],
  handcrafted: ["home.titleHandcrafted1", "home.titleHandcrafted2"]
};

type Banner = {
  slug: string;
  brand: string;
  titleLines: string[];
  href: string;
  image: string;
  tone: (typeof TONES)[number];
};

function ShopNowBadge({ brand, slug, shopNow, collectionBy }: { brand: string; slug: string; shopNow: string; collectionBy: string }) {
  const arcId = `cat-arc-${slug}`;

  return (
    <span className="cat-banner-cta" aria-hidden="true">
      <svg className="cat-banner-arc" viewBox="0 0 120 120">
        <defs>
          <path id={arcId} d="M 18,60 A 42,42 0 0 1 102,60" />
        </defs>
        <text>
          <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
            {`${collectionBy} ${brand.toUpperCase()}`}
          </textPath>
        </text>
      </svg>
      <span className="cat-banner-shop">{shopNow}</span>
    </span>
  );
}

export function CategoryBanners({
  categories
}: {
  categories?: Array<{ slug: string; name: string }>;
} = {}) {
  const t = useT();
  const [rawRows, setRawRows] = useState<Array<{ slug: string; name: string }>>(categories || []);

  useEffect(() => {
    if (categories?.length) {
      setRawRows(categories);
      return;
    }

    fetch("/api/categories")
      .then((res) => res.json())
      .then((payload) => {
        setRawRows((payload?.data || []) as Array<{ slug: string; name: string }>);
      })
      .catch(() => setRawRows([]));
  }, [categories]);

  const banners: Banner[] = useMemo(
    () =>
      rawRows.map((row, index) => {
        const keys = TITLE_KEYS[row.slug];
        return {
          slug: row.slug,
          brand: "Vasritha",
          titleLines: keys ? [t(keys[0]), t(keys[1])] : row.name.split(" "),
          href: `/${row.slug}`,
          image: FALLBACK_IMAGES[row.slug] || "/hero-silk.png",
          tone: TONES[index % TONES.length]
        };
      }),
    [rawRows, t]
  );

  if (!banners.length) return null;

  return (
    <section className="category-banners">
      <div className="shell category-banners-head" data-reveal>
        <div className="eyebrow">{t("home.shopByCategory")}</div>
        <h2>{t("home.everyRoom")}</h2>
      </div>

      <div className="category-banner-list">
        {banners.map((banner, index) => (
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
              <ShopNowBadge
                brand={banner.brand}
                slug={banner.slug}
                shopNow={t("home.shopNow")}
                collectionBy={t("home.collectionBy")}
              />
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
