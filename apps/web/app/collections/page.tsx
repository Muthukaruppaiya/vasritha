"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Footer, Header } from "../../components/storefront";
import type { CatalogProduct } from "../../components/product-globe";
import { useT } from "../../lib/i18n/provider";

const ProductGlobe = dynamic(
  () => import("../../components/product-globe").then((mod) => mod.ProductGlobe),
  {
    ssr: false,
    loading: () => (
      <div className="shell section">
        <p className="muted">Loading collections…</p>
      </div>
    )
  }
);

export default function CollectionsPage() {
  const t = useT();
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);

  useEffect(() => {
    fetch("/api/products?mode=card&limit=24")
      .then((res) => res.json())
      .then((payload) => {
        const rows = (payload?.data || []) as CatalogProduct[];
        setProducts(rows.slice(0, 24));
      })
      .catch(() => setProducts([]));
  }, []);

  return (
    <>
      <Header />
      <main className="collections-page">
        <section className="collections-layout">
          <div className="collections-title shell" data-reveal>
            <div className="eyebrow">{t("common.allCollections")}</div>
            <h1>{t("home.everyRoom")}</h1>
          </div>
          {products.length > 0 ? (
            <ProductGlobe
              products={products}
              onProductChange={() => undefined}
              onProductSelect={setSelectedProduct}
            />
          ) : (
            <div className="shell section">
              <p className="muted">Loading collections…</p>
            </div>
          )}
        </section>
        {selectedProduct && (
          <div className="status-modal" role="dialog" aria-modal="true" aria-label={selectedProduct.name}>
            <button
              className="status-modal-backdrop"
              aria-label="Close product preview"
              onClick={() => setSelectedProduct(null)}
            />
            <div className="status-modal-card">
              <button
                className="status-modal-close"
                aria-label="Close product preview"
                onClick={() => setSelectedProduct(null)}
              >
                <X size={20} />
              </button>
              <Image src={selectedProduct.imageSrc} alt={selectedProduct.name} width={546} height={819} />
              <div>
                <div className="eyebrow">{selectedProduct.type}</div>
                <h3>{selectedProduct.name}</h3>
                <p className="muted">{selectedProduct.description}</p>
                <div className="price">{selectedProduct.price}</div>
                <Link
                  className="btn"
                  href={`/products/${selectedProduct.slug}`}
                  onClick={() => setSelectedProduct(null)}
                >
                  Explore now
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
