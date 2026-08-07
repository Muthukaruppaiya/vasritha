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

type CheckoutLine = {
  productId: string;
  variantId?: string | null;
  slug: string;
  name: string;
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
  const fromCart = searchParams.get("from") === "cart";
  const productSlug = searchParams.get("product") ?? "";
  const size = searchParams.get("size") ?? "";
  const [ready, setReady] = useState(false);
  const [lineItems, setLineItems] = useState<CheckoutLine[]>([]);

  const session = useMemo(() => (ready ? getCustomerSession() : null), [ready]);
  const nextCheckout = `/checkout?${searchParams.toString()}`;
  const paymentHref = `/checkout/payment?from=${encodeURIComponent(nextCheckout)}`;

  const orderTotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const compareTotal = lineItems.reduce(
    (sum, item) => sum + (item.compareAtPrice || 0) * item.quantity,
    0
  );
  const savings = Math.max(0, compareTotal - orderTotal);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace(`/account/register?next=${encodeURIComponent(nextCheckout)}`);
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
      <main className="shell section checkout-page" data-reveal>
        <p className="muted">Preparing your secure checkout…</p>
      </main>
    );
  }

  return (
    <main className="shell section checkout-page" data-reveal>
      <header className="checkout-hero">
        <p className="eyebrow">Secure checkout</p>
        <h1>Order summary</h1>
        <p className="muted checkout-lead">
          Review your details, then continue to Razorpay payment.
        </p>
      </header>

      <div className="checkout-layout">
        <section className="checkout-panel" aria-labelledby="checkout-customer">
          <div className="checkout-block">
            <h2 id="checkout-customer">Customer</h2>
            <p className="checkout-value">{session.name}</p>
            <p className="muted checkout-meta">{session.email}</p>
            <p className="muted checkout-meta">{session.phone}</p>
          </div>

          <div className="checkout-block">
            <div className="checkout-block-head">
              <h2>Delivery address</h2>
              <Link className="checkout-edit" href={`/account/address?next=${encodeURIComponent(nextCheckout)}`}>
                Change address
              </Link>
            </div>
            <p className="checkout-value">
              {session.address.line1}
              {session.address.line2 ? `, ${session.address.line2}` : ""}
            </p>
            <p className="muted checkout-meta">
              {session.address.city}, {session.address.state} {session.address.pincode}
            </p>
          </div>
        </section>

        <section className="checkout-panel" aria-labelledby="checkout-items">
          <div className="checkout-block">
            <h2 id="checkout-items">{lineItems.length > 1 ? "Items" : "Item"}</h2>
            <ul className="checkout-items">
              {lineItems.map((item) => (
                <li key={`${item.productId}-${item.size}`}>
                  <div className="checkout-item-media">
                    <Image src={item.imageSrc} alt={item.name} fill sizes="88px" />
                  </div>
                  <div className="checkout-item-copy">
                    <strong>{item.name}</strong>
                    <p className="muted checkout-meta">
                      {item.type}
                      {item.size ? ` · Size ${item.size}` : ""}
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
              ))}
            </ul>
          </div>

          <div className="checkout-totals">
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
            <p className="muted checkout-secure-note">Next: Razorpay test checkout · Cards, UPI & netbanking</p>
          </form>
        </section>
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
          <main className="shell section checkout-page">
            <p className="muted">Loading checkout…</p>
          </main>
        }
      >
        <CheckoutContent />
      </Suspense>
      <Footer />
    </>
  );
}
