"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CART_EVENT,
  CartItem,
  formatPrice,
  getCartItems,
  removeFromCart,
  updateCartQuantity
} from "../lib/cart";
import { resolveCartCheckoutPath } from "../lib/customer-session";
import { useLocale, useT } from "../lib/i18n/provider";
import { localizeCategoryName, localizeProductFields, localizeSize } from "../lib/i18n/catalog-local";

type SuggestProduct = {
  slug: string;
  name: string;
  shortName: string;
  type: string;
  price: string;
  compareAtPrice?: string;
  imageSrc: string;
};

export function CartBag() {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestProduct[]>([]);

  const browseLinks = [
    { href: "/sarees", label: localizeCategoryName("sarees", locale) },
    { href: "/jewelry", label: localizeCategoryName("jewelry", locale) },
    { href: "/handcrafted", label: localizeCategoryName("handcrafted", locale) },
    { href: "/collections", label: t("common.collections") }
  ];

  useEffect(() => {
    const sync = () => setItems(getCartItems());
    sync();
    setReady(true);
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((payload) => {
        setSuggestions(((payload?.data || []) as SuggestProduct[]).slice(0, 3));
      })
      .catch(() => setSuggestions([]));
  }, []);

  const lines = useMemo(() => items, [items]);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const compareTotal = lines.reduce(
    (sum, line) => sum + (line.compareAtPrice || line.price) * line.quantity,
    0
  );
  const savings = Math.max(0, compareTotal - subtotal);
  const freeShipping = subtotal >= 2500;

  if (!ready) {
    return (
      <main className="shell section bag-page" data-reveal>
        <p className="muted">{t("bag.opening")}</p>
      </main>
    );
  }

  if (lines.length === 0) {
    return (
      <main className="shell section bag-page" data-reveal>
        <header className="bag-hero">
          <p className="eyebrow">{t("bag.eyebrow")}</p>
          <h1>{t("bag.title")}</h1>
          <p className="muted bag-lead">{t("bag.emptyLead")}</p>
        </header>

        <section className="bag-empty" aria-label="Empty bag">
          <div className="bag-empty-copy">
            <h2>{t("bag.beginEdit")}</h2>
            <p className="muted">{t("bag.emptyHint")}</p>
            <div className="bag-empty-actions">
              <Link className="btn" href="/sarees">
                {t("bag.exploreSarees")}
              </Link>
              <Link className="bag-text-link" href="/jewelry">
                {t("bag.shopJewelry")}
              </Link>
            </div>
            <nav className="bag-browse" aria-label="Browse categories">
              {browseLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {suggestions.length > 0 && (
            <div className="bag-suggest">
              <div className="bag-suggest-head">
                <p className="eyebrow">{t("bag.youMayLove")}</p>
                <h3>{t("bag.startWithThese")}</h3>
              </div>
              <div className="bag-suggest-grid">
                {suggestions.map((product) => {
                  const localized = localizeProductFields(
                    {
                      slug: product.slug,
                      name: product.name,
                      shortName: product.shortName,
                      type: product.type
                    },
                    locale
                  );
                  return (
                  <Link key={product.slug} href={`/products/${product.slug}`} className="bag-suggest-card">
                    <div className="bag-suggest-media">
                      <Image src={product.imageSrc} alt={localized.name} fill sizes="160px" />
                    </div>
                    <div className="bag-suggest-copy">
                      <span>{localized.type}</span>
                      <strong>{localized.shortName || localized.name}</strong>
                      <div className="bag-price-row">
                        <em>{product.price}</em>
                        {product.compareAtPrice && <s>{product.compareAtPrice}</s>}
                      </div>
                    </div>
                  </Link>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="shell section bag-page" data-reveal>
      <header className="bag-hero">
        <p className="eyebrow">{t("bag.eyebrow")}</p>
        <h1>{t("bag.title")}</h1>
        <p className="muted bag-lead">
          {lines.length} {t("bag.items")} — {t("checkout.checkout")}
        </p>
      </header>

      <div className="bag-layout">
        <section className="bag-lines" aria-label={t("bag.items")}>
          {lines.map((line) => {
            const localized = localizeProductFields(
              {
                slug: line.slug,
                name: line.name,
                shortName: line.name,
                type: line.type
              },
              locale
            );
            return (
            <article key={`${line.productId}-${line.size}`} className="bag-line">
              <Link href={`/products/${line.slug}`} className="bag-line-media">
                <Image src={line.imageSrc} alt={localized.name} fill sizes="120px" />
              </Link>
              <div className="bag-line-body">
                <div className="bag-line-top">
                  <div className="bag-line-info">
                    <div className="bag-line-type">{localized.type}</div>
                    <h2>
                      <Link href={`/products/${line.slug}`}>{localized.name}</Link>
                    </h2>
                    <p className="muted">
                      {t("common.size")} {localizeSize(line.size, locale)}
                    </p>
                  </div>
                  <div className="bag-line-prices">
                    <strong>{formatPrice(line.price * line.quantity)}</strong>
                    {line.compareAtPrice ? (
                      <s>{formatPrice(line.compareAtPrice * line.quantity)}</s>
                    ) : null}
                  </div>
                </div>
                <div className="bag-line-controls">
                  <div className="bag-qty" aria-label={t("bag.qty")}>
                    <button
                      type="button"
                      aria-label={t("bag.decrease")}
                      onClick={() =>
                        updateCartQuantity(line.productId, line.variantId, line.quantity - 1)
                      }
                    >
                      −
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      type="button"
                      aria-label={t("bag.increase")}
                      onClick={() =>
                        updateCartQuantity(line.productId, line.variantId, line.quantity + 1)
                      }
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="bag-remove"
                    onClick={() => removeFromCart(line.productId, line.variantId)}
                  >
                    {t("bag.remove")}
                  </button>
                </div>
              </div>
            </article>
            );
          })}
        </section>

        <aside className="bag-summary">
          <h2>{t("checkout.checkout")}</h2>
          <div className="bag-summary-row">
            <span>{t("bag.subtotal")}</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>
          {savings > 0 && (
            <div className="bag-summary-row bag-summary-save">
              <span>{t("bag.savings")}</span>
              <strong>{formatPrice(savings)}</strong>
            </div>
          )}
          <div className="bag-summary-row">
            <span>{t("checkout.shipping")}</span>
            <strong>
              {freeShipping ? t("bag.freeShippingUnlocked") : t("checkout.checkout")}
            </strong>
          </div>
          <p className="muted bag-shipping-note">
            {freeShipping
              ? t("bag.freeShippingUnlocked")
              : t("bag.freeShippingHint")}
          </p>
          <div className="bag-summary-total">
            <span>{t("account.total")}</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>
          <button
            type="button"
            className="btn bag-checkout"
            onClick={() => router.push(resolveCartCheckoutPath())}
          >
            {t("bag.checkout")}
          </button>
          <Link className="bag-text-link" href="/collections">
            {t("common.continueShopping")}
          </Link>
        </aside>
      </div>
    </main>
  );
}
