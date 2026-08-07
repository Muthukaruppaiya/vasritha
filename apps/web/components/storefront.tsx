"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { BuyButton } from "./buy-button";
import type { StoreProduct } from "../lib/catalog";
import { useLocale, useT } from "../lib/i18n/provider";
import { localizeCategoryName, localizeProductFields } from "../lib/i18n/catalog-local";

export { Header } from "./site-header";

type NavCategory = { name: string; slug: string };
type NavCollection = { name: string; slug: string };

export function Footer({
  categories: initialCategories
}: {
  categories?: NavCategory[];
} = {}) {
  const t = useT();
  const { locale } = useLocale();
  const year = new Date().getFullYear();
  const [categories, setCategories] = useState<NavCategory[]>(initialCategories || []);
  const collections: NavCollection[] = [
    { name: t("footer.kanchipuram"), slug: "sarees" },
    { name: t("footer.banarasi"), slug: "sarees" },
    { name: t("footer.softSilk"), slug: "sarees" },
    { name: t("footer.cottonWeaves"), slug: "sarees" }
  ];

  useEffect(() => {
    if (initialCategories?.length) {
      setCategories(initialCategories);
      return;
    }

    fetch("/api/categories")
      .then((res) => res.json())
      .then((payload) => {
        const cats = (payload?.data || []) as NavCategory[];
        setCategories(cats);
      })
      .catch(() => setCategories([]));
  }, [initialCategories]);

  return (
    <footer className="footer" data-reveal>
      <div className="shell footer-grid">
        <div className="footer-brand">
          <Link href="/" className="footer-logo-link" aria-label="Vasritha home">
            <span className="footer-logo-circle">
              <img
                className="footer-logo"
                src="/vasritha-logo-footer-circle.png"
                alt="Vasritha — Timeless Elegance"
              />
            </span>
          </Link>
          <p>{t("footer.tagline")}</p>
          <div className="footer-contact">
            <a href="mailto:hello@vasritha.com">hello@vasritha.com</a>
            <a href="tel:+919876543210">+91 98765 43210</a>
            <span>{t("footer.worldwide")}</span>
          </div>
        </div>

        <div>
          <h4>{t("footer.explore")}</h4>
          <Link href="/">{t("common.home")}</Link>
          <Link href="/collections">{t("common.allCollections")}</Link>
                  {categories.map((category) => (
                    <Link key={category.slug} href={`/${category.slug}`}>
                      {localizeCategoryName(category.slug, locale, category.name)}
                    </Link>
                  ))}
          <Link href="/checkout">{t("common.offers")}</Link>
        </div>

        <div>
          <h4>{t("footer.collections")}</h4>
          {collections.map((collection) => (
            <Link key={collection.name} href={`/${collection.slug}`}>
              {collection.name}
            </Link>
          ))}
        </div>

        <div>
          <h4>{t("footer.customerCare")}</h4>
          <Link href="/account">{t("common.myAccount")}</Link>
          <a href="#">{t("footer.shippingReturns")}</a>
          <a href="#">{t("footer.sizeGuide")}</a>
          <a href="/account#orders">{t("footer.orderTracking")}</a>
          <a href="#">{t("footer.faqs")}</a>
          <a href="#">{t("footer.contactUs")}</a>
        </div>

        <div>
          <h4>{t("footer.stayConnected")}</h4>
          <p className="footer-note">{t("footer.newsletterNote")}</p>
          <form className="footer-subscribe" action="#">
            <input
              type="email"
              name="email"
              placeholder={t("footer.yourEmail")}
              aria-label={t("footer.yourEmail")}
              required
            />
            <button type="submit">{t("footer.join")}</button>
          </form>
          <div className="footer-social">
            <a href="#" aria-label="Instagram">
              Instagram
            </a>
            <a href="#" aria-label="Facebook">
              Facebook
            </a>
            <a href="#" aria-label="WhatsApp">
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="shell footer-bottom-inner">
          <p className="footer-copy">
            © {year} Vasritha. {t("footer.rights")}
          </p>
          <div className="footer-legal">
            <a href="#">{t("footer.privacy")}</a>
            <span aria-hidden="true">·</span>
            <a href="#">{t("footer.terms")}</a>
          </div>
          <p className="footer-credit">
            {t("footer.developedBy")}{" "}
            <a href="https://gypsycode.com" target="_blank" rel="noreferrer">
              Gypsy Code
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export function ProductCard({
  product,
  variant = "default"
}: {
  product: StoreProduct;
  variant?: "default" | "listing";
}) {
  const t = useT();
  const { locale } = useLocale();
  const localized = localizeProductFields(product, locale);
  const isListing = variant === "listing";

  return (
    <article className={`card${isListing ? " card--listing" : ""}`}>
      <Link href={`/products/${product.slug}`}>
        <div className="picture">
          <Image
            src={product.imageSrc}
            alt={localized.name}
            fill
            sizes="(max-width: 800px) 50vw, 25vw"
          />
          {!isListing && <span>{localized.type}</span>}
        </div>
      </Link>
      <div className="card-body">
        {!isListing && <div className="eyebrow">{localized.type}</div>}
        {isListing && <div className="card-type">{localized.type}</div>}
        <h3>
          <Link href={`/products/${product.slug}`}>
            {isListing ? localized.shortName : localized.name}
          </Link>
        </h3>
        <div className="card-price-row">
          <div className="price">{product.price}</div>
          {product.compareAtPrice && <s className="card-compare">{product.compareAtPrice}</s>}
        </div>
        {isListing && (
          <div className="card-actions">
            {product.sizes.length > 1 ? (
              <Link href={`/products/${product.slug}`} className="card-buy-link">
                {t("common.selectSizeBuy")}
              </Link>
            ) : (
              <BuyButton
                productSlug={product.slug}
                size={product.sizes[0]}
                className="btn card-buy-btn"
              >
                {t("common.buy")}
              </BuyButton>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
