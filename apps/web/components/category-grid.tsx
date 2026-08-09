"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const FALLBACK_IMAGES: Record<string, string> = {
  sarees: "/hero-silk.png",
  jewelry: "/hero-jewelry.png",
  "churidhars-salwars": "/hero-salwar.png",
  handcrafted: "/catalog-wooden-item.png"
};

type CategoryCard = {
  slug: string;
  name: string;
  image: string;
  lines: string[];
};

export function CategoryGrid() {
  const [categories, setCategories] = useState<CategoryCard[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((payload) => {
        const rows = (payload?.data || []) as Array<{
          slug: string;
          name: string;
          image_path?: string | null;
        }>;
        setCategories(
          rows.map((row) => ({
            slug: row.slug,
            name: row.name,
            image: row.image_path || FALLBACK_IMAGES[row.slug] || "/hero-silk.png",
            lines: [row.name]
          }))
        );
      })
      .catch(() => setCategories([]));
  }, []);

  if (!categories.length) return null;

  return (
    <section className="shell section category-grid-section">
      <div className="category-grid-head">
        <div className="category-grid-intro">
          <div className="eyebrow">Shop the boutique</div>
          <h2>Categories</h2>
        </div>
        <Link className="category-grid-link" href="/collections">
          All collections →
        </Link>
      </div>

      <div className="overlay-card-grid category-grid">
        {categories.map((category) => (
          <Link key={category.slug} href={`/${category.slug}`} className="overlay-card">
            <Image
              src={category.image}
              alt={category.name}
              fill
              sizes="(max-width:800px) 48vw, 24vw"
            />
            <span className="overlay-card-veil" aria-hidden="true" />
            <span className="overlay-card-title">
              {category.lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
