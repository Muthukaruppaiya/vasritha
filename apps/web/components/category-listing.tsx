"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "./storefront";
import type { StoreCategory, StoreProduct } from "../lib/catalog";
import { useLocale, useT } from "../lib/i18n/provider";
import { localizeCategoryName } from "../lib/i18n/catalog-local";

type SortKey = "featured" | "price-asc" | "price-desc" | "name";

export function CategoryListing({
  category,
  products
}: {
  category: StoreCategory;
  products: StoreProduct[];
}) {
  const t = useT();
  const { locale } = useLocale();
  const categoryName = localizeCategoryName(category.slug, locale, category.name);
  const [activeType, setActiveType] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("featured");
  const [otherCategories, setOtherCategories] = useState<StoreCategory[]>([]);

  useEffect(() => {
    const FALLBACK: Record<string, string> = {
      sarees: "/hero-silk.png",
      jewelry: "/hero-jewelry.png",
      "churidhars-salwars": "/hero-salwar.png",
      handcrafted: "/catalog-wooden-item.png"
    };
    fetch("/api/categories")
      .then((res) => res.json())
      .then((payload) => {
        const rows = (payload?.data || []) as Array<{
          id: string;
          name: string;
          slug: string;
          description?: string;
          image_path?: string | null;
        }>;
        setOtherCategories(
          rows
            .filter((row) => row.slug !== category.slug)
            .map((row) => ({
              id: row.id,
              name: row.name,
              slug: row.slug,
              description: row.description || "",
              sort_order: 0,
              image: row.image_path || FALLBACK[row.slug] || "/hero-silk.png",
              subcategories: [],
              lines: [row.name]
            }))
        );
      })
      .catch(() => setOtherCategories([]));
  }, [category.slug]);

  const shown = useMemo(() => {
    const filtered =
      activeType === "all"
        ? products
        : products.filter((product) => product.type === activeType);

    const next = [...filtered];
    if (sort === "price-asc") next.sort((a, b) => a.priceValue - b.priceValue);
    if (sort === "price-desc") next.sort((a, b) => b.priceValue - a.priceValue);
    if (sort === "name") next.sort((a, b) => a.name.localeCompare(b.name));
    return next;
  }, [activeType, products, sort]);

  const chips = [
    { id: "all", label: t("listing.all") },
    ...category.subcategories.map((item) => ({
      id: item,
      label: item.replace(/ Sarees$/i, "").replace(/ Items$/i, "")
    }))
  ];

  return (
    <>
      <section className="listing-hero" data-reveal="fade">
        <div className="listing-hero-media" aria-hidden="true">
          <Image src={category.image} alt="" fill priority sizes="100vw" />
          <span className="listing-hero-veil" />
        </div>
        <div className="shell listing-hero-copy">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">{t("common.home")}</Link>
            <span>/</span>
            <span>{categoryName}</span>
          </nav>
          <div className="eyebrow">{t("listing.boutiqueEdit")}</div>
          <h1>{categoryName}</h1>
          <p>{category.description}</p>
        </div>
      </section>

      <section className="shell listing-page">
        <div className="listing-filters" data-reveal>
          <div className="listing-chips" role="tablist" aria-label={`${categoryName} filters`}>
            {chips.map((chip) => {
              const isActive = activeType === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`listing-chip${isActive ? " is-active" : ""}`}
                  onClick={() => setActiveType(chip.id)}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          <label className="listing-sort">
            <span className="listing-sort-label">{t("listing.sortBy")}</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="featured">{t("listing.featured")}</option>
              <option value="name">{t("listing.nameAZ")}</option>
              <option value="price-asc">{t("listing.priceLowHigh")}</option>
              <option value="price-desc">{t("listing.priceHighLow")}</option>
            </select>
          </label>
        </div>

        {shown.length ? (
          <div className="products listing-products">
            {shown.map((product, index) => (
              <div key={product.slug} data-reveal data-reveal-delay={String((index % 4) + 1)}>
                <ProductCard product={product} variant="listing" />
              </div>
            ))}
          </div>
        ) : (
          <div className="listing-empty" data-reveal>
            <h2>{t("listing.noProducts")}</h2>
            <p className="muted">{category.description}</p>
            <Link className="btn" href="/collections">
              {t("common.allCollections")}
            </Link>
          </div>
        )}

        <div className="listing-more" data-reveal>
          <div className="eyebrow">{t("listing.exploreMore")}</div>
          <div className="listing-more-grid">
            {otherCategories.map((item, index) => (
              <Link
                key={item.slug}
                href={`/${item.slug}`}
                className="listing-more-card"
                data-reveal
                data-reveal-delay={String(index + 1)}
              >
                <Image src={item.image} alt="" fill sizes="(max-width:800px) 45vw, 20vw" />
                <span>{localizeCategoryName(item.slug, locale, item.name)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
