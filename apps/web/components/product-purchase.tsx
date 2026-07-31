"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "../lib/cart";
import { BuyButton } from "./buy-button";
import { products } from "../lib/mock-data";

type Product = (typeof products)[number];

export function ProductPurchase({
  product,
  categoryLabel
}: {
  product: Product;
  categoryLabel: string;
}) {
  const router = useRouter();
  const [size, setSize] = useState(product.sizes[0] ?? "One Size");
  const [added, setAdded] = useState(false);
  const showSizePicker = product.sizes.length > 1;

  const onAddToBag = () => {
    addToCart(product.slug, size, 1);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="product-purchase">
      {showSizePicker ? (
        <div className="product-size">
          <div className="product-size-head">
            <span>Select size</span>
            <strong>{size}</strong>
          </div>
          <div className="product-size-options" role="listbox" aria-label="Select size">
            {product.sizes.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={size === option}
                className={`product-size-option${size === option ? " is-active" : ""}`}
                onClick={() => setSize(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="product-size-note">
          Size <strong>{product.sizes[0] ?? "One Size"}</strong>
        </p>
      )}

      <div className="product-detail-actions">
        <BuyButton productSlug={product.slug} size={size} className="btn product-detail-buy">
          Buy now
        </BuyButton>
        <button type="button" className="btn product-detail-cta" onClick={onAddToBag}>
          {added ? "Added to bag" : "Add to bag"}
        </button>
        {added && (
          <button type="button" className="product-detail-secondary" onClick={() => router.push("/cart")}>
            View bag
          </button>
        )}
        {!added && (
          <Link href={`/${product.category}`} className="product-detail-secondary">
            Back to {categoryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
