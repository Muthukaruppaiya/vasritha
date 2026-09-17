"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductCard } from "./storefront";
import type { StoreProduct } from "../lib/catalog";
import { useT } from "../lib/i18n/provider";

export function SearchResults({
  query,
  categorySlug = null
}: {
  query: string;
  categorySlug?: string | null;
}) {
  const t = useT();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const needle = query.trim().toLowerCase();

  useEffect(() => {
    const params = new URLSearchParams({ mode: "card", limit: "100" });
    if (categorySlug) params.set("category", categorySlug);
    setLoading(true);
    fetch(`/api/products?${params.toString()}`)
      .then((res) => res.json())
      .then((payload) => {
        const rows = (payload?.data || []) as StoreProduct[];
        if (!needle) {
          setProducts(rows.slice(0, 24));
          return;
        }
        setProducts(
          rows.filter((row) => {
            const hay = [row.name, row.shortName, row.type, row.sku, row.tag, row.slug]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return hay.includes(needle);
          })
        );
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [needle, categorySlug]);

  return (
    <main className="shell section search-page" data-reveal>
      <header className="search-page-head">
        <p className="eyebrow">{t("common.search")}</p>
        <h1>{needle ? `Results for “${query.trim()}”` : "Search the boutique"}</h1>
        {categorySlug ? (
          <p className="muted">
            Scoped to <Link href={`/${categorySlug}`}>{categorySlug.replace(/-/g, " ")}</Link>
          </p>
        ) : (
          <p className="muted">Find sarees, jewelry, and handcrafted pieces by name or product ID.</p>
        )}
      </header>

      {loading ? <p className="muted">Searching…</p> : null}
      {!loading && products.length === 0 ? (
        <p className="muted">No products matched. Try another word or browse collections.</p>
      ) : null}

      {!loading && products.length > 0 ? (
        <div className="products">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} variant="listing" />
          ))}
        </div>
      ) : null}
    </main>
  );
}
