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
  parsePrice,
  removeFromCart,
  updateCartQuantity
} from "../lib/cart";
import { resolveCartCheckoutPath } from "../lib/customer-session";
import { products } from "../lib/mock-data";

type EnrichedItem = CartItem & {
  product: (typeof products)[number];
  lineTotal: number;
};

const suggestions = products.slice(0, 3);

const browseLinks = [
  { href: "/sarees", label: "Sarees" },
  { href: "/jewelry", label: "Jewelry" },
  { href: "/handcrafted", label: "Handcrafted" },
  { href: "/collections", label: "Collections" }
];

export function CartBag() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

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

  const lines = useMemo(() => {
    return items
      .map((item) => {
        const product = products.find((entry) => entry.slug === item.slug);
        if (!product) return null;
        return {
          ...item,
          product,
          lineTotal: parsePrice(product.price) * item.quantity
        };
      })
      .filter(Boolean) as EnrichedItem[];
  }, [items]);

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const compareTotal = lines.reduce(
    (sum, line) => sum + parsePrice(line.product.compareAtPrice) * line.quantity,
    0
  );
  const savings = Math.max(0, compareTotal - subtotal);
  const freeShipping = subtotal >= 2500;

  if (!ready) {
    return (
      <main className="shell section bag-page" data-reveal>
        <p className="muted">Opening your bag…</p>
      </main>
    );
  }

  if (lines.length === 0) {
    return (
      <main className="shell section bag-page" data-reveal>
        <header className="bag-hero">
          <p className="eyebrow">Your bag</p>
          <h1>Your selection awaits</h1>
          <p className="muted bag-lead">
            Nothing here yet. Choose a saree, jewel, or handcrafted piece and keep it ready for checkout.
          </p>
        </header>

        <section className="bag-empty" aria-label="Empty bag">
          <div className="bag-empty-copy">
            <h2>Begin your edit</h2>
            <p className="muted">Browse a category, then return here to review and pay.</p>
            <div className="bag-empty-actions">
              <Link className="btn" href="/sarees">
                Explore sarees
              </Link>
              <Link className="bag-text-link" href="/jewelry">
                Shop jewelry
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

          <div className="bag-suggest">
            <div className="bag-suggest-head">
              <p className="eyebrow">You may love</p>
              <h3>Start with these</h3>
            </div>
            <div className="bag-suggest-grid">
              {suggestions.map((product) => (
                <Link key={product.slug} href={`/products/${product.slug}`} className="bag-suggest-card">
                  <div className="bag-suggest-media">
                    <Image src={product.imageSrc} alt={product.name} fill sizes="160px" />
                  </div>
                  <div className="bag-suggest-copy">
                    <span>{product.type}</span>
                    <strong>{product.shortName}</strong>
                    <div className="bag-price-row">
                      <em>{product.price}</em>
                      {product.compareAtPrice && <s>{product.compareAtPrice}</s>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell section bag-page" data-reveal>
      <header className="bag-hero">
        <p className="eyebrow">Your bag</p>
        <h1>Ready when you are</h1>
        <p className="muted bag-lead">
          {lines.length} {lines.length === 1 ? "piece" : "pieces"} selected — review sizes, then continue to secure checkout.
        </p>
      </header>

      <div className="bag-layout">
        <section className="bag-lines" aria-label="Bag items">
          {lines.map((line) => (
            <article key={`${line.slug}-${line.size}`} className="bag-line">
              <Link href={`/products/${line.slug}`} className="bag-line-media">
                <Image src={line.product.imageSrc} alt={line.product.name} fill sizes="120px" />
              </Link>
              <div className="bag-line-body">
                <div className="bag-line-top">
                  <div className="bag-line-info">
                    <div className="bag-line-type">{line.product.type}</div>
                    <h2>
                      <Link href={`/products/${line.slug}`}>{line.product.name}</Link>
                    </h2>
                    <p className="muted">Size {line.size}</p>
                  </div>
                  <div className="bag-line-prices">
                    <strong>{formatPrice(line.lineTotal)}</strong>
                    {line.product.compareAtPrice && (
                      <s>{formatPrice(parsePrice(line.product.compareAtPrice) * line.quantity)}</s>
                    )}
                  </div>
                </div>
                <div className="bag-line-controls">
                  <div className="bag-qty" aria-label="Quantity">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => updateCartQuantity(line.slug, line.size, line.quantity - 1)}
                    >
                      −
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => updateCartQuantity(line.slug, line.size, line.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="bag-remove"
                    onClick={() => removeFromCart(line.slug, line.size)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>

        <aside className="bag-summary">
          <h2>Order summary</h2>
          <div className="bag-summary-row">
            <span>Subtotal</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>
          {savings > 0 && (
            <div className="bag-summary-row bag-summary-save">
              <span>You save</span>
              <strong>{formatPrice(savings)}</strong>
            </div>
          )}
          <div className="bag-summary-row">
            <span>Shipping</span>
            <strong>{freeShipping ? "Complimentary" : "Calculated at checkout"}</strong>
          </div>
          <p className="muted bag-shipping-note">
            {freeShipping
              ? "Your order qualifies for complimentary shipping."
              : `Add ${formatPrice(2500 - subtotal)} more for complimentary shipping.`}
          </p>
          <div className="bag-summary-total">
            <span>Total</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>
          <button
            type="button"
            className="btn bag-checkout"
            onClick={() => router.push(resolveCartCheckoutPath())}
          >
            Continue to checkout
          </button>
          <Link className="bag-text-link" href="/collections">
            Keep browsing
          </Link>
        </aside>
      </div>
    </main>
  );
}
