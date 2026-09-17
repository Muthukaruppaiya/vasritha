"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Footer, Header } from "../../components/storefront";
import { useT } from "../../lib/i18n/provider";

type CollectionProduct = {
  slug: string;
  name: string;
  shortName?: string;
  type: string;
  price: string;
  compareAtPrice?: string;
  imageSrc: string;
  category?: string;
};

export default function CollectionsPage() {
  const t = useT();
  const [products, setProducts] = useState<CollectionProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/products?mode=card&limit=48")
      .then((res) => res.json())
      .then((payload) => {
        const rows = (payload?.data || []) as CollectionProduct[];
        setProducts(rows);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Header />
      <main className="collections-page collections-page--grid">
        <section className="shell section collections-grid-section" data-reveal>
          <div className="collections-title">
            <div className="eyebrow">{t("common.allCollections")}</div>
            <h1>{t("home.everyRoom")}</h1>
            <p className="muted">Browse every piece currently in stock — tap a card to open details.</p>
          </div>

          {loading ? (
            <p className="muted">Loading collections…</p>
          ) : products.length === 0 ? (
            <p className="muted">No products available right now.</p>
          ) : (
            <div className="collections-box-grid">
              {products.map((product) => (
                <Link
                  key={product.slug}
                  href={`/products/${product.slug}`}
                  className="collections-box-card"
                >
                  <div className="collections-box-media">
                    <Image
                      src={product.imageSrc}
                      alt={product.name}
                      fill
                      sizes="(max-width:800px) 45vw, 220px"
                    />
                  </div>
                  <div className="collections-box-copy">
                    <span>{product.type}</span>
                    <strong>{product.shortName || product.name}</strong>
                    <em>{product.price}</em>
                    {product.compareAtPrice ? <s>{product.compareAtPrice}</s> : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
