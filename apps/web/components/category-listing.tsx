"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ProductCard } from "./storefront";
import { categories, products } from "../lib/mock-data";

type Category = (typeof categories)[number];
type SortKey = "featured" | "price-asc" | "price-desc" | "name";

function priceValue(price: string) {
  return Number(price.replace(/[^\d]/g, "")) || 0;
}

export function CategoryListing({ category }: { category: Category }) {
  const [activeType, setActiveType] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("featured");

  const catalog = useMemo(
    () => products.filter((product) => product.category === category.slug),
    [category.slug]
  );

  const shown = useMemo(() => {
    const filtered =
      activeType === "all"
        ? catalog
        : catalog.filter((product) => product.type === activeType);

    const next = [...filtered];
    if (sort === "price-asc") next.sort((a, b) => priceValue(a.price) - priceValue(b.price));
    if (sort === "price-desc") next.sort((a, b) => priceValue(b.price) - priceValue(a.price));
    if (sort === "name") next.sort((a, b) => a.name.localeCompare(b.name));
    return next;
  }, [activeType, catalog, sort]);

  const chips = [
    { id: "all", label: "All" },
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
            <Link href="/">Home</Link>
            <span>/</span>
            <span>{category.name}</span>
          </nav>
          <div className="eyebrow">Boutique edit</div>
          <h1>{category.name}</h1>
          <p>{category.description}</p>
        </div>
      </section>

      <section className="shell listing-page">
        <div className="listing-filters" data-reveal>
          <div className="listing-chips" role="tablist" aria-label={`${category.name} filters`}>
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
            <span className="listing-sort-label">Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="featured">Featured</option>
              <option value="name">Name A–Z</option>
              <option value="price-asc">Price: Low–High</option>
              <option value="price-desc">Price: High–Low</option>
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
            <h2>Coming soon</h2>
            <p className="muted">Our {category.name.toLowerCase()} edit is being prepared for you.</p>
            <Link className="btn" href="/collections">Explore collections</Link>
          </div>
        )}

        <div className="listing-more" data-reveal>
          <div className="eyebrow">Continue browsing</div>
          <div className="listing-more-grid">
            {categories
              .filter((item) => item.slug !== category.slug)
              .map((item, index) => (
                <Link
                  key={item.slug}
                  href={`/${item.slug}`}
                  className="listing-more-card"
                  data-reveal
                  data-reveal-delay={String(index + 1)}
                >
                  <Image src={item.image} alt="" fill sizes="(max-width:800px) 45vw, 20vw" />
                  <span>{item.name}</span>
                </Link>
              ))}
          </div>
        </div>
      </section>
    </>
  );
}
