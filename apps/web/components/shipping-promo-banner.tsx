"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CART_EVENT, formatPrice, getCartItems } from "../lib/cart";
import type { ShippingQuote } from "../lib/shipping";

/**
 * Site-wide dynamic free-shipping promo driven by cart + /api/shipping/quote.
 * Does not calculate fees itself — reuses the same backend quote as checkout.
 */
export function ShippingPromoBanner() {
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [cartValue, setCartValue] = useState(0);

  useEffect(() => {
    const sync = () => {
      const items = getCartItems();
      const subtotal = items.reduce((sum, line) => sum + line.price * line.quantity, 0);
      setCartValue(subtotal);
    };
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (cartValue <= 0) {
      setQuote(null);
      return;
    }
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/shipping/quote?subtotal=${encodeURIComponent(String(cartValue))}`, {
        signal: ac.signal
      })
        .then((res) => res.json())
        .then((payload) => {
          const data = payload?.data as ShippingQuote | undefined;
          if (!data || data.free_shipping_min <= 0 || !data.delivery_available) {
            setQuote(null);
            return;
          }
          setQuote(data);
        })
        .catch(() => setQuote(null));
    }, 120);
    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [cartValue]);

  if (!quote || quote.free_shipping_min <= 0) return null;

  const unlocked = quote.free_shipping;
  const message = unlocked
    ? "Congratulations! You unlocked FREE SHIPPING 🎉"
    : `Add ${formatPrice(quote.remaining_for_free)} more to get FREE SHIPPING`;

  return (
    <div
      className={`shipping-promo${unlocked ? " is-unlocked" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="shell shipping-promo-inner">
        <p className="shipping-promo-msg">{message}</p>
        {!unlocked ? (
          <div className="shipping-promo-meter" aria-hidden="true">
            <div
              className="shipping-promo-meter-fill"
              style={{ width: `${Math.min(100, quote.progress_percent)}%` }}
            />
          </div>
        ) : null}
        <Link className="shipping-promo-link" href="/shipping-policy">
          Shipping policy
        </Link>
      </div>
    </div>
  );
}
