"use client";

import Link from "next/link";
import { ProductGallery } from "./product-gallery";
import { ProductPurchase } from "./product-purchase";
import { ProductCard } from "./storefront";
import type { StoreProduct } from "../lib/catalog";
import { useLocale, useT } from "../lib/i18n/provider";
import { localizeProductFields } from "../lib/i18n/catalog-local";

export function LocalizedProductDetail({
  product,
  related
}: {
  product: StoreProduct;
  related: StoreProduct[];
}) {
  const t = useT();
  const { locale } = useLocale();
  const localized = localizeProductFields(product, locale);
  const localizedProduct = {
    ...product,
    name: localized.name,
    shortName: localized.shortName,
    type: localized.type,
    categoryName: localized.categoryName,
    description: localized.description,
    shortDescription: localized.shortDescription,
    color: localized.color
  };

  return (
    <section className="shell product-page-inner">
      <nav className="product-crumbs" data-reveal="fade" aria-label="Breadcrumb">
        <Link href="/">{t("common.home")}</Link>
        <span>/</span>
        <Link href={`/${product.category}`}>{localized.categoryName}</Link>
        <span>/</span>
        <span>{localized.shortName}</span>
      </nav>

      <div className="product-detail">
        <div className="product-detail-media" data-reveal="left">
          <ProductGallery images={product.images} alt={localized.name} />
        </div>

        <div className="product-detail-info" data-reveal="right" data-reveal-delay="1">
          <div className="eyebrow">{localized.type}</div>
          <p className="product-detail-short">{localized.shortName}</p>
          <h1 className="product-detail-title">{localized.name}</h1>

          <div className="product-detail-pricing">
            <span className="product-detail-price">{product.price}</span>
            {product.compareAtPrice && (
              <span className="product-detail-compare">{product.compareAtPrice}</span>
            )}
          </div>

          {localized.color ? (
            <p className="product-detail-meta">
              <span>{t("product.colour")}</span>
              <strong>{localized.color}</strong>
            </p>
          ) : null}

          {localized.shortDescription ? (
            <p className="product-detail-copy">{localized.shortDescription}</p>
          ) : null}
          <p className="product-detail-copy">{localized.description}</p>

          <ul className="product-detail-perks">
            <li>{t("product.perkSelected")}</li>
            <li>{t("product.perkShipping")}</li>
            <li>{t("product.perkPacking")}</li>
          </ul>

          <ProductPurchase product={localizedProduct} categoryLabel={localized.categoryName} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="product-related" data-reveal>
          <div className="product-related-head">
            <div>
              <div className="eyebrow">{t("product.related")}</div>
              <h2>{t("product.moreFromEdit")}</h2>
            </div>
            <Link href={`/${product.category}`}>{t("listing.exploreMore")} →</Link>
          </div>
          <div className="products product-related-grid">
            {related.map((item, index) => (
              <div key={item.slug} data-reveal data-reveal-delay={String(index + 1)}>
                <ProductCard product={item} variant="listing" />
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
