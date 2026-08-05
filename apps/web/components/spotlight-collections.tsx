"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useT } from "../lib/i18n/provider";
import { localizeProductFields } from "../lib/i18n/catalog-local";

type RawProduct = {
  name: string;
  shortName: string;
  slug: string;
  category: string;
  imageSrc: string;
  isFeatured?: boolean;
};

type SpotlightSection = {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  href: string;
  products: RawProduct[];
};

export function SpotlightCollections() {
  const t = useT();
  const { locale } = useLocale();
  const [sections, setSections] = useState<SpotlightSection[]>([]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((payload) => {
        const products = (payload?.data || []) as RawProduct[];

        if (!products.length) {
          setSections([]);
          return;
        }

        const featured = products.filter((product) => product.isFeatured);
        const firstSource = featured.length ? featured : products;
        const first = firstSource.slice(0, 4);

        const secondSource = products.filter(
          (product) => !featured.some((f) => f.slug === product.slug)
        );
        const second = (secondSource.length ? secondSource : products).slice(0, 4);

        setSections([
          {
            id: "fast-selling",
            eyebrow: t("home.mostLoved"),
            title: t("home.fastSelling"),
            lead: t("home.fastSellingLead"),
            href: "/collections",
            products: first
          },
          {
            id: "new-arrivals",
            eyebrow: t("home.newSeason"),
            title: t("home.newArrivals"),
            lead: t("home.newArrivalsLead"),
            href: "/collections",
            products: second.length ? second : first
          }
        ]);
      })
      .catch(() => setSections([]));
  }, [t]);

  const localizedSections = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        items: section.products.map((product) => {
          const localized = localizeProductFields(
            {
              slug: product.slug,
              name: product.name,
              shortName: product.shortName,
              type: product.category
            },
            locale
          );
          const label = localized.shortName || localized.name;
          return {
            name: label,
            lines: label.split(" ").slice(0, 2),
            href: `/products/${product.slug}`,
            image: product.imageSrc
          };
        })
      })),
    [sections, locale]
  );

  if (!localizedSections.length) return null;

  return (
    <div className="spotlight-stack">
      {localizedSections.map((section) => (
        <section
          key={section.id}
          className={`shell section spotlight-section spotlight-section--${section.id}`}
          data-reveal
        >
          <div className="spotlight-head">
            <div className="eyebrow">{section.eyebrow}</div>
            <h2>{section.title}</h2>
            <div className="spotlight-rule" aria-hidden="true" />
            <div className="spotlight-meta">
              <p className="muted">{section.lead}</p>
              <Link className="spotlight-link" href={section.href}>
                {t("listing.exploreMore")} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className="overlay-card-grid spotlight-grid">
            {section.items.map((item, index) => (
              <Link
                key={`${section.id}-${item.href}`}
                href={item.href}
                className="overlay-card"
                data-reveal
                data-reveal-delay={String((index % 4) + 1)}
              >
                <Image src={item.image} alt={item.name} fill sizes="(max-width:800px) 48vw, 24vw" />
                <span className="overlay-card-veil" aria-hidden="true" />
                <span className="overlay-card-title">
                  {item.lines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
