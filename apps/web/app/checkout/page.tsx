"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Footer, Header } from "../../components/storefront";
import { formatPrice, getCartItems } from "../../lib/cart";
import {
  getCachedAddress,
  getCustomerSession,
  isLoggedIn
} from "../../lib/customer-session";
import { cartItemsToPendingLines, createPendingFromCheckout } from "../../lib/order";
import type { StoreProduct } from "../../lib/catalog";
import { useLocale } from "../../lib/i18n/provider";
import { localizeProductFields, localizeSize } from "../../lib/i18n/catalog-local";
import { getAppliedCoupon, COUPON_EVENT, type AppliedCoupon } from "../../lib/applied-coupon";

type CheckoutLine = {
  productId: string;
  variantId?: string | null;
  slug: string;
  name: string;
  shortName: string;
  type: string;
  size: string;
  quantity: number;
  price: number;
  compareAtPrice?: number;
  imageSrc: string;
  total: number;
};

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const fromCart = searchParams.get("from") === "cart";
  const productSlug = searchParams.get("product") ?? "";
  const size = searchParams.get("size") ?? "";
  const [ready, setReady] = useState(false);
  const [lineItems, setLineItems] = useState<CheckoutLine[]>([]);
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedCoupon | null>(null);

  const session = useMemo(() => (ready ? getCustomerSession() : null), [ready]);
  const nextCheckout = `/checkout?${searchParams.toString()}`;
  const paymentHref = `/checkout/payment?from=${encodeURIComponent(nextCheckout)}`;

  const orderTotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const compareTotal = lineItems.reduce(
    (sum, item) => sum + (item.compareAtPrice || 0) * item.quantity,
    0
  );
  const savings = Math.max(0, compareTotal - orderTotal);
  const itemCount = lineItems.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    const syncCoupon = () => setAppliedVoucher(getAppliedCoupon());
    syncCoupon();
    window.addEventListener(COUPON_EVENT, syncCoupon);
    window.addEventListener("storage", syncCoupon);
    return () => {
      window.removeEventListener(COUPON_EVENT, syncCoupon);
      window.removeEventListener("storage", syncCoupon);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace(`/login?next=${encodeURIComponent(nextCheckout)}`);
      return;
    }
    if (!getCachedAddress()?.id) {
      router.replace(`/account/address?next=${encodeURIComponent(nextCheckout)}`);
      return;
    }
    if (fromCart && getCartItems().length === 0) {
      router.replace("/cart");
      return;
    }

    const load = async () => {
      if (fromCart) {
        const cart = getCartItems();
        setLineItems(
          cart.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            slug: item.slug,
            name: item.name,
            shortName: item.shortName || item.name,
            type: item.type || "",
            size: item.size,
            quantity: item.quantity,
            price: item.price,
            compareAtPrice: item.compareAtPrice,
            imageSrc: item.imageSrc,
            total: item.price * item.quantity
          }))
        );
        setReady(true);
        return;
      }

      if (!productSlug) {
        router.replace("/collections");
        return;
      }

      const res = await fetch(`/api/products/${encodeURIComponent(productSlug)}?related=0`);
      const payload = await res.json().catch(() => ({}));
      const product = (payload?.data?.product || payload?.data) as StoreProduct | undefined;
      if (!product) {
        router.replace("/collections");
        return;
      }

      const variant =
        product.variants.find((entry) => entry.name === size) || product.variants[0] || null;

      setLineItems([
        {
          productId: product.id,
          variantId: variant?.id ?? null,
          slug: product.slug,
          name: product.name,
          shortName: product.shortName || product.name,
          type: product.type,
          size: size || variant?.name || product.sizes[0] || "Free Size",
          quantity: 1,
          price: variant?.price ?? product.priceValue,
          compareAtPrice: product.compareAtValue,
          imageSrc: product.imageSrc,
          total: variant?.price ?? product.priceValue
        }
      ]);
      setReady(true);
    };

    void load();
  }, [router, nextCheckout, fromCart, productSlug, size]);

  const onPay = (event: FormEvent) => {
    event.preventDefault();
    const address = getCachedAddress();
    if (!address?.id || !lineItems.length) return;

    createPendingFromCheckout({
      fromCart,
      shippingAddressId: address.id,
      items: cartItemsToPendingLines(
        lineItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          slug: item.slug,
          name: item.name,
          shortName: item.shortName,
          type: item.type,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
          compareAtPrice: item.compareAtPrice,
          imageSrc: item.imageSrc
        }))
      )
    });
    router.push(paymentHref);
  };

  if (!ready || !session) {
    return (
      <main className="checkout-page" data-reveal>
        <div className="shell section checkout-page-inner">
          <p className="muted">Preparing your secure checkout…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="checkout-page" data-reveal>
      <div className="shell section checkout-page-inner">
      <nav className="checkout-progress" aria-label="Checkout steps">
        <span className="is-current">Summary</span>
        <span>Payment</span>
        <span>Confirmed</span>
      </nav>

      <header className="checkout-hero">
        <p className="eyebrow">Secure checkout</p>
        <h1>Order summary</h1>
        <p className="muted checkout-lead">
          Confirm your details, then continue to Razorpay.
        </p>
      </header>

      <div className="checkout-layout">
        <section className="checkout-details" aria-label="Customer and delivery">
          <article className="checkout-surface">
            <p className="checkout-kicker">Customer</p>
            <p className="checkout-value">{session.name}</p>
            <p className="muted checkout-meta">{session.email}</p>
            <p className="muted checkout-meta">{session.phone}</p>
          </article>

          <article className="checkout-surface">
            <div className="checkout-block-head">
              <p className="checkout-kicker">Delivery address</p>
              <Link
                className="checkout-edit"
                href={`/account/address?next=${encodeURIComponent(nextCheckout)}`}
              >
                Change
              </Link>
            </div>
            <p className="checkout-value">
              {session.address.line1}
              {session.address.line2 ? `, ${session.address.line2}` : ""}
            </p>
            <p className="muted checkout-meta">
              {session.address.city}, {session.address.state} {session.address.pincode}
            </p>
          </article>
        </section>

        <section className="checkout-bag" aria-labelledby="checkout-items">
          <div className="checkout-bag-head">
            <div>
              <p className="checkout-kicker">Your bag</p>
              <h2 id="checkout-items">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </h2>
            </div>
          </div>

          <ul className="checkout-items">
            {lineItems.map((item) => {
              const localized = localizeProductFields(
                {
                  slug: item.slug,
                  name: item.name,
                  shortName: item.shortName,
                  type: item.type
                },
                locale
              );
              const sizeLabel = localizeSize(item.size, locale);
              return (
                <li key={`${item.productId}-${item.size}`}>
                  <div className="checkout-item-media">
                    <Image src={item.imageSrc} alt={localized.name} fill sizes="96px" />
                  </div>
                  <div className="checkout-item-copy">
                    <strong>{localized.shortName}</strong>
                    {localized.name !== localized.shortName ? (
                      <p className="checkout-item-fullname">{localized.name}</p>
                    ) : null}
                    <p className="muted checkout-meta">
                      {localized.type}
                      {item.size ? ` · Size ${sizeLabel}` : ""}
                      {item.quantity > 1 ? ` · Qty ${item.quantity}` : ""}
                    </p>
                    <div className="checkout-price-row">
                      <span>{formatPrice(item.total)}</span>
                      {item.compareAtPrice ? (
                        <s>{formatPrice(item.compareAtPrice * item.quantity)}</s>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="checkout-totals">
            {appliedVoucher ? (
              <p className="voucher-applied">
                Gift voucher <strong>{appliedVoucher.code}</strong> will apply at payment.
              </p>
            ) : null}
            <div className="checkout-total-line">
              <span>Subtotal</span>
              <span>{formatPrice(orderTotal)}</span>
            </div>
            {savings > 0 && (
              <div className="checkout-total-line checkout-save-line">
                <span>You save</span>
                <strong>{formatPrice(savings)}</strong>
              </div>
            )}
            <div className="checkout-total-line checkout-total-row">
              <span>Total</span>
              <strong>{formatPrice(orderTotal)}</strong>
            </div>
          </div>

          <form className="checkout-pay-form" onSubmit={onPay}>
            <button className="btn checkout-pay" type="submit">
              Continue to payment
            </button>
            <p className="muted checkout-secure-note">
              Razorpay · Cards, UPI & netbanking · Test mode
            </p>
          </form>
        </section>
      </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <main className="checkout-page">
            <div className="shell section checkout-page-inner">
              <p className="muted">Loading checkout…</p>
            </div>
          </main>
        }
      >
        <CheckoutContent />
      </Suspense>
      <Footer />
    </>
  );
}
