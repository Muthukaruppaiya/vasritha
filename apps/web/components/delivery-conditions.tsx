"use client";

import { formatPrice } from "../lib/cart";
import type { ShippingQuote } from "../lib/shipping";

type Props = {
  quote: ShippingQuote;
  /** Compact variant for cart sidebar */
  compact?: boolean;
};

export function DeliveryConditions({ quote, compact }: Props) {
  const pct = Math.min(100, Math.max(0, quote.progress_percent));
  const showFreeTrack = quote.free_shipping_min > 0;

  return (
    <div
      className={`delivery-conditions${quote.delivery_available ? "" : " is-unavailable"}${
        quote.free_shipping ? " is-free" : ""
      }${compact ? " is-compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="delivery-conditions-head">
        <strong>Delivery</strong>
        <span className={`delivery-pill${quote.delivery_available ? " is-ok" : " is-bad"}`}>
          {quote.delivery_available ? "Available" : "Unavailable"}
        </span>
      </div>

      <p className="delivery-conditions-msg">{quote.delivery_message}</p>

      {quote.delivery_available ? (
        <>
          <div className="delivery-conditions-row">
            <span>Delivery charge</span>
            <strong>
              {quote.free_shipping || quote.shipping_amount <= 0
                ? "FREE"
                : formatPrice(quote.shipping_amount)}
            </strong>
          </div>

          {showFreeTrack ? (
            <div className="delivery-free-track">
              <div className="offer-unlock-meter" aria-hidden="true">
                <div className="offer-unlock-meter-fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="offer-unlock-ratio muted">
                {formatPrice(quote.subtotal)} / {formatPrice(quote.free_shipping_min)}
              </p>
              <p className="delivery-free-msg">
                {quote.free_shipping
                  ? "Congratulations! You unlocked FREE SHIPPING 🎉"
                  : `Add ${formatPrice(quote.remaining_for_free)} more to get FREE SHIPPING`}
              </p>
            </div>
          ) : null}

            {quote.estimated_delivery_text ? (
              <p className="delivery-eta muted">Est. delivery: {quote.estimated_delivery_text}</p>
            ) : null}
            {quote.category_fees && quote.category_fees.length > 0 ? (
              <ul className="delivery-category-fees muted">
                {quote.category_fees.map((fee) => (
                  <li key={fee.category_id}>
                    {fee.category_name}: {fee.is_free ? "FREE" : formatPrice(fee.charge)}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="delivery-eta muted">
              <a href="/shipping-policy">View shipping policy</a>
            </p>
        </>
      ) : null}
    </div>
  );
}
