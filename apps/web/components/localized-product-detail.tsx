"use client";

import Link from "next/link";
import { ProductGallery } from "./product-gallery";
import { ProductPurchase } from "./product-purchase";
import { PurchasePolicyNotice } from "./purchase-policy-notice";
import { ProductCard } from "./storefront";
import type { StoreProduct } from "../lib/catalog";
import type { PurchasePolicySummary } from "../lib/purchase-policy-display";
import { useLocale, useT } from "../lib/i18n/provider";
import { localizeProductFields } from "../lib/i18n/catalog-local";

function colorSwatch(name: string) {
  const n = name.toLowerCase();
  if (/(crimson|maroon|wine|burgundy)/.test(n)) return "#7a1f2b";
  if (/(red|scarlet|ruby)/.test(n)) return "#b42318";
  if (/(pink|rose|blush)/.test(n)) return "#c45d7a";
  if (/(gold|mustard|amber)/.test(n)) return "#c89b5c";
  if (/(yellow|lemon)/.test(n)) return "#d4a017";
  if (/(green|emerald|olive|mehndi)/.test(n)) return "#3d6b4f";
  if (/(blue|navy|indigo|sapphire)/.test(n)) return "#2f4a6e";
  if (/(purple|violet|lavender)/.test(n)) return "#6b4c7a";
  if (/(orange|coral|peach)/.test(n)) return "#c46b3a";
  if (/(brown|coffee|chocolate|tan)/.test(n)) return "#6b3f2a";
  if (/(beige|cream|ivory|off.?white|ecru)/.test(n)) return "#e8d5c0";
  if (/(white|snow)/.test(n)) return "#f7f1ea";
  if (/(black|ebony|charcoal)/.test(n)) return "#1f1a17";
  if (/(grey|gray|silver)/.test(n)) return "#8a8178";
  return "#8a6a57";
}

function formatSavings(compareAt: number, price: number) {
  const saved = Math.max(0, compareAt - price);
  if (saved <= 0) return null;
  const pct = Math.round((saved / compareAt) * 100);
  return {
    amount: `₹${saved.toLocaleString("en-IN")}`,
    pct
  };
}

export function LocalizedProductDetail({
  product,
  related,
  purchasePolicy
}: {
  product: StoreProduct;
  related: StoreProduct[];
  purchasePolicy?: PurchasePolicySummary | null;
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

  const comingSoon = Boolean(product.restockExpected && product.stock_quantity <= 0);
  const inStock = product.stock_quantity > 0;
  const limited = inStock && product.stock_quantity <= 3;
  const savings =
    product.compareAtValue != null
      ? formatSavings(product.compareAtValue, product.priceValue)
      : null;
  const description = (localized.description || "").trim();
  const shortDescription = (localized.shortDescription || "").trim();
  const looksLikePlaceholder = (text: string) => {
    if (text.length < 10) return true;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= 5 && !/[.,;:!?—'"]/.test(text) && words.every((w) => w.length <= 8)) {
      return true;
    }
    return false;
  };
  const lead = shortDescription && !looksLikePlaceholder(shortDescription) ? shortDescription : "";
  const body = description && !looksLikePlaceholder(description) ? description : "";
  const hasRealCopy = Boolean(lead || body);

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
          <div className="product-detail-badges" aria-label="Product status">
            {savings ? (
              <span className="product-badge product-badge--sale">
                {t("product.savePercent", { pct: savings.pct })}
              </span>
            ) : null}
            {comingSoon ? (
              <span className="product-badge product-badge--soon">{t("product.comingSoon")}</span>
            ) : limited ? (
              <span className="product-badge product-badge--limited">{t("product.limitedPieces")}</span>
            ) : inStock ? (
              <span className="product-badge product-badge--stock">{t("product.inStock")}</span>
            ) : (
              <span className="product-badge product-badge--out">{t("product.outOfStock")}</span>
            )}
          </div>

          <div className="eyebrow">{localized.type}</div>
          <p className="product-detail-short">{localized.shortName}</p>
          <h1 className="product-detail-title">{localized.name}</h1>

          {(product.tag || product.sku) ? (
            <p className="product-detail-meta">
              <span>{t("product.productId")}</span>
              <strong>{product.tag || product.sku}</strong>
            </p>
          ) : null}

          <div className="product-detail-pricing">
            <span className="product-detail-price">{product.price}</span>
            {product.compareAtPrice ? (
              <span className="product-detail-compare">{product.compareAtPrice}</span>
            ) : null}
            {savings ? (
              <span className="product-detail-save">
                {t("product.youSave", { amount: savings.amount })}
              </span>
            ) : null}
          </div>

          {localized.color ? (
            <div className="product-detail-color">
              <span className="product-detail-color-label">{t("product.colour")}</span>
              <span
                className="product-detail-swatch"
                style={{ background: colorSwatch(product.color || localized.color) }}
                aria-hidden="true"
              />
              <strong>{localized.color}</strong>
            </div>
          ) : null}

          {lead ? <p className="product-detail-lead">{lead}</p> : null}

          <ProductPurchase
            product={localizedProduct}
            categoryLabel={localized.categoryName}
            stickyMobile
          />

          <ul className="product-trust" aria-label="Boutique promises">
            <li>
              <span className="product-trust-mark" aria-hidden="true" />
              <div>
                <strong>{t("product.perkSelected")}</strong>
                <p>{t("product.uniquePiece")}</p>
              </div>
            </li>
            <li>
              <span className="product-trust-mark" aria-hidden="true" />
              <div>
                <strong>{t("product.perkShipping")}</strong>
                <p>{t("product.securePay")}</p>
              </div>
            </li>
            <li>
              <span className="product-trust-mark" aria-hidden="true" />
              <div>
                <strong>{t("product.perkPacking")}</strong>
                <p>{t("product.giftReady")}</p>
              </div>
            </li>
          </ul>

          <div className="product-panels">
            <details className="product-panel" open={hasRealCopy}>
              <summary>{t("product.details")}</summary>
              <div className="product-panel-body">
                {body ? (
                  <p className="product-detail-copy">{body}</p>
                ) : (
                  <p className="product-detail-copy muted">
                    {t("product.detailsFallback")}
                  </p>
                )}
              </div>
            </details>

            <details className="product-panel">
              <summary>{t("product.careShipping")}</summary>
              <div className="product-panel-body">
                <PurchasePolicyNotice summary={purchasePolicy} variant="detail" />
              </div>
            </details>
          </div>
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
