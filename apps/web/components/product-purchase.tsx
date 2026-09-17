"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addToCart } from "../lib/cart";
import type { StoreProduct } from "../lib/catalog";
import { useLocale, useT } from "../lib/i18n/provider";
import { localizeSize } from "../lib/i18n/catalog-local";

export function ProductPurchase({
  product,
  categoryLabel
}: {
  product: StoreProduct;
  categoryLabel: string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const [size, setSize] = useState(product.sizes[0] ?? "Free Size");
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const showSizePicker = product.sizes.length > 1;

  const selectedVariant =
    product.variants.find((variant) => variant.name === size) || product.variants[0] || null;

  const reserveAndGoToCart = async () => {
    setBusy(true);
    setError("");
    const result = await addToCart({
      productId: product.id,
      variantId: selectedVariant?.id ?? null,
      slug: product.slug,
      name: product.name,
      shortName: product.shortName,
      size,
      price: selectedVariant?.price ?? product.priceValue,
      compareAtPrice: product.compareAtValue,
      imageSrc: product.imageSrc,
      type: product.type,
      quantity: 1
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  };

  const onAddToBag = async () => {
    const ok = await reserveAndGoToCart();
    if (!ok) return;
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  const onBuyNow = async () => {
    const ok = await reserveAndGoToCart();
    if (!ok) return;
    router.push("/cart");
  };

  return (
    <div className="product-purchase">
      {showSizePicker ? (
        <div className="product-size">
          <div className="product-size-head">
            <span>{t("common.selectSize")}</span>
            <strong>{localizeSize(size, locale)}</strong>
          </div>
          <div className="product-size-options" role="listbox" aria-label={t("common.selectSize")}>
            {product.sizes.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={size === option}
                className={`product-size-option${size === option ? " is-active" : ""}`}
                onClick={() => setSize(option)}
              >
                {localizeSize(option, locale)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="product-size-note">
          {t("common.size")}{" "}
          <strong>{localizeSize(product.sizes[0] ?? "Free Size", locale)}</strong>
        </p>
      )}

      <div className="product-detail-actions">
        <button
          type="button"
          className="btn product-detail-buy"
          onClick={() => void onBuyNow()}
          disabled={busy}
        >
          {busy ? "Reserving…" : t("common.buyNow")}
        </button>
        <button
          type="button"
          className="btn product-detail-cta"
          onClick={() => void onAddToBag()}
          disabled={busy}
        >
          {busy ? "Reserving…" : added ? t("common.addedToBag") : t("common.addToBag")}
        </button>
        {added && (
          <button type="button" className="product-detail-secondary" onClick={() => router.push("/cart")}>
            {t("common.viewBag")}
          </button>
        )}
        {!added && (
          <Link href={`/${product.category}`} className="product-detail-secondary">
            {categoryLabel}
          </Link>
        )}
      </div>
      {error ? <p className="product-purchase-error">{error}</p> : null}
      <p className="product-hold-hint muted">
        Bag hold: stock is reserved for 30 minutes after you add an item.
      </p>
    </div>
  );
}
