"use client";

import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { useState } from "react";
import { Footer, Header } from "../../components/storefront";
import { CatalogProduct, ProductGlobe } from "../../components/product-globe";

export default function CollectionsPage() {
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  return (
    <><Header />
      <main className="collections-page">
        <section className="collections-layout">
          <div className="collections-title shell" data-reveal>
            <div className="eyebrow">All Collections</div>
            <h1>A world of weaves</h1>
          </div>
          <ProductGlobe onProductChange={() => undefined} onProductSelect={setSelectedProduct} />
        </section>
        {selectedProduct && <div className="status-modal" role="dialog" aria-modal="true" aria-label={selectedProduct.name}>
          <button className="status-modal-backdrop" aria-label="Close product preview" onClick={() => setSelectedProduct(null)} />
          <div className="status-modal-card">
            <button className="status-modal-close" aria-label="Close product preview" onClick={() => setSelectedProduct(null)}><X size={20} /></button>
            <Image src={selectedProduct.imageSrc} alt={selectedProduct.name} width={546} height={819} />
            <div><div className="eyebrow">{selectedProduct.type}</div><h3>{selectedProduct.name}</h3><p className="muted">{selectedProduct.description}</p><div className="price">{selectedProduct.price}</div><Link className="btn" href={`/products/${selectedProduct.slug}`} onClick={() => setSelectedProduct(null)}>Explore now</Link></div>
          </div>
        </div>}
      </main>
      <Footer />
    </>
  );
}
