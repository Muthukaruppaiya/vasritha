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
  const needle = query.trim();

  useEffect(() => {
    const params = new URLSearchParams({ mode: "card", limit: needle ? "72" : "24" });
    if (categorySlug) params.set("category", categorySlug);
    if (needle) params.set("q", needle);
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/products?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((payload) => {
        setProducts((payload?.data || []) as StoreProduct[]);
      })
      .catch(() => {
        if (!controller.signal.aborted) setProducts([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [needle, categorySlug]);

  return (
    <main className="shell section search-page" data-reveal>
      <header className="search-page-head">
        <p className="eyebrow">{t("common.search")}</p>
        <h1>{needle ? `Results for “${needle}”` : "Search the boutique"}</h1>
        {categorySlug ? (
          <p className="muted">
            Scoped to <Link href={`/${categorySlug}`}>{categorySlug.replace(/-/g, " ")}</Link>
          </p>
        ) : (
          <p className="muted">Search by product name, SKU, color, tag, or category.</p>
        )}
        {!loading && needle ? (
          <p className="muted">
            {products.length} match{products.length === 1 ? "" : "es"}
          </p>
        ) : null}
      </header>

      {loading ? <p className="muted">Searching…</p> : null}
      {!loading && products.length === 0 ? (
        <p className="muted">
          {needle
            ? "No products matched. Try a shorter word, SKU, or browse collections."
            : "Type a product name in the header search to begin."}
        </p>
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
