import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Header } from "../../components/storefront";
import { ensureCategoriesSchema } from "../../lib/catalog";
import { query } from "../../lib/db/pool";
import { getShippingSettings } from "../../lib/shipping";
import {
  buildPurchasePolicySummary,
  getExchangePolicySettings
} from "../../lib/exchange-policy";
import { formatPrice } from "../../lib/cart";

export const metadata: Metadata = {
  title: "Shipping Policy | Vasritha",
  description:
    "Delivery availability, shipping charges, free shipping and estimated delivery for Vasritha orders."
};

export const dynamic = "force-dynamic";

function pincodeModeLabel(mode: string) {
  if (mode === "allowlist") return "Selected PIN codes only";
  if (mode === "blocklist") return "All India except listed PIN codes";
  return "Available across India";
}

export default async function ShippingPolicyPage() {
  const settings = await getShippingSettings();
  const exchange = await getExchangePolicySettings();
  const purchaseSummary = buildPurchasePolicySummary(exchange);
  await ensureCategoriesSchema();
  const categoryRates = await query<{
    name: string;
    shipping_charge: string | number;
    shipping_is_free: boolean;
  }>(
    `select name, coalesce(shipping_charge, 0) as shipping_charge,
            coalesce(shipping_is_free, false) as shipping_is_free
     from categories
     where coalesce(shipping_rate_active, false) = true
       and coalesce(is_published, true) = true
     order by sort_order asc, name asc`
  ).catch(() => [] as Array<{ name: string; shipping_charge: string | number; shipping_is_free: boolean }>);
  const pinList = settings.delivery_pincodes
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const combineLabel =
    settings.category_shipping_combine_mode === "sum"
      ? "category rates are added together"
      : "the highest category rate applies for the order";

  return (
    <>
      <Header />
      <main className="shell section policy-page" data-reveal>
        <header className="policy-hero">
          <p className="eyebrow">Customer care</p>
          <h1>Shipping Policy</h1>
          <p className="muted policy-lead">
            How we deliver your sarees, jewelry, and handcrafted pieces — charges and free shipping
            follow the shop settings below.
          </p>
        </header>

        <div className="policy-banner policy-banner--warn" role="note">
          <strong>{purchaseSummary.no_refund_headline}</strong>
          <p>
            {purchaseSummary.online_summary}{" "}
            <Link href="/exchange-policy">Read the full exchange policy</Link>.
          </p>
        </div>

        {purchaseSummary.in_store_only ? (
          <div className="policy-banner" role="note">
            <strong>IN-STORE PURCHASES</strong>
            <p>{purchaseSummary.in_store_text}</p>
          </div>
        ) : null}

        <div className="policy-grid">
          <article className="policy-card">
            <h2>Delivery availability</h2>
            {settings.delivery_enabled ? (
              <>
                <p>
                  Online delivery is <strong>currently available</strong>. Service coverage:{" "}
                  <strong>{pincodeModeLabel(settings.delivery_pincode_mode)}</strong>.
                </p>
                {settings.delivery_pincode_mode !== "all" && pinList.length > 0 ? (
                  <p className="muted policy-pins">
                    PIN list: {pinList.slice(0, 24).join(", ")}
                    {pinList.length > 24 ? "…" : ""}
                  </p>
                ) : null}
                {settings.delivery_pincode_mode === "allowlist" && pinList.length === 0 ? (
                  <p className="muted">
                    Delivery areas are being configured. Please contact us before ordering.
                  </p>
                ) : null}
              </>
            ) : (
              <p>
                Online delivery is <strong>temporarily unavailable</strong>. Please visit the boutique
                or contact us for assistance.
              </p>
            )}
          </article>

          <article className="policy-card">
            <h2>Shipping charges</h2>
            {settings.default_shipping_fee > 0 ? (
              <p>
                Default delivery charge:{" "}
                <strong>{formatPrice(settings.default_shipping_fee)}</strong> when no category rate
                applies (unless free shipping unlocks).
              </p>
            ) : (
              <p>
                Default delivery fee is <strong>complimentary</strong> when no category rate applies.
              </p>
            )}
            {categoryRates.length > 0 ? (
              <>
                <p className="muted">
                  Active category rates ({combineLabel}):
                </p>
                <ul className="policy-list">
                  {categoryRates.map((row) => (
                    <li key={row.name}>
                      {row.name}:{" "}
                      <strong>
                        {row.shipping_is_free
                          ? "FREE"
                          : formatPrice(Number(row.shipping_charge || 0))}
                      </strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">
                Category-specific rates can be set in admin Categories. Until then, the default
                charge above applies.
              </p>
            )}
            <p className="muted">
              The charge shown in your bag and at checkout is the charge applied when you pay.
            </p>
          </article>

          <article className="policy-card">
            <h2>Free shipping</h2>
            {settings.free_shipping_min > 0 ? (
              <p>
                Enjoy <strong>FREE SHIPPING</strong> on orders of{" "}
                <strong>{formatPrice(settings.free_shipping_min)}</strong> or more (after product
                prices, before payment).
              </p>
            ) : (
              <p>
                A free-shipping threshold is not set. Delivery follows the standard shipping charge
                above.
              </p>
            )}
            <p className="muted">
              Your bag shows how much more you need to unlock free shipping as you shop.
            </p>
          </article>

          <article className="policy-card">
            <h2>Estimated delivery</h2>
            <p>
              {settings.estimated_delivery_text ||
                "Delivery timelines are shared at checkout for your address."}
            </p>
          </article>

          <article className="policy-card">
            <h2>Order processing</h2>
            <p>
              {settings.order_processing_text ||
                "Orders are packed within 1–2 business days after payment confirmation."}
            </p>
          </article>

          <article className="policy-card">
            <h2>Restrictions & notes</h2>
            {settings.shipping_policy_notes?.trim() ? (
              <p className="policy-notes">{settings.shipping_policy_notes}</p>
            ) : (
              <ul className="policy-list">
                <li>Delivery is confirmed against your PIN code at checkout.</li>
                <li>Remote or restricted areas may not be serviceable.</li>
                <li>
                  Gift vouchers and discounts apply at payment; free shipping uses cart subtotal.
                </li>
              </ul>
            )}
          </article>
        </div>

        <div className="policy-actions">
          <Link className="btn" href="/collections">
            Continue shopping
          </Link>
          <Link className="policy-text-link" href="/exchange-policy">
            Exchange policy
          </Link>
          <Link className="policy-text-link" href="/cart">
            View bag
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
