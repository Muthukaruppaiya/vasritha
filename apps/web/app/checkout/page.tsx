"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Footer, Header } from "../../components/storefront";
import { formatPrice, getCartItems, parsePrice } from "../../lib/cart";
import { getCustomerSession, isLoggedIn } from "../../lib/customer-session";
import { createPendingFromCheckout } from "../../lib/order";
import { products } from "../../lib/mock-data";

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromCart = searchParams.get("from") === "cart";
  const productSlug = searchParams.get("product") ?? "";
  const size = searchParams.get("size") ?? "";
  const [ready, setReady] = useState(false);

  const session = useMemo(() => (ready ? getCustomerSession() : null), [ready]);
  const nextCheckout = `/checkout?${searchParams.toString()}`;
  const paymentHref = `/checkout/payment?from=${encodeURIComponent(nextCheckout)}`;

  const lineItems = useMemo(() => {
    if (!ready) return [];
    if (fromCart) {
      return getCartItems()
        .map((item) => {
          const product = products.find((entry) => entry.slug === item.slug);
          if (!product) return null;
          return {
            product,
            size: item.size,
            quantity: item.quantity,
            total: parsePrice(product.price) * item.quantity
          };
        })
        .filter(Boolean) as Array<{
        product: (typeof products)[number];
        size: string;
        quantity: number;
        total: number;
      }>;
    }

    const product = products.find((item) => item.slug === productSlug) ?? products[0];
    return [
      {
        product,
        size: size || product.sizes[0] || "One Size",
        quantity: 1,
        total: parsePrice(product.price)
      }
    ];
  }, [ready, fromCart, productSlug, size]);

  const orderTotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const compareTotal = lineItems.reduce(
    (sum, item) => sum + parsePrice(item.product.compareAtPrice) * item.quantity,
    0
  );
  const savings = Math.max(0, compareTotal - orderTotal);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace(`/account/register?next=${encodeURIComponent(nextCheckout)}`);
      return;
    }
    if (!getCustomerSession()?.address?.line1) {
      router.replace(`/account/address?next=${encodeURIComponent(nextCheckout)}`);
      return;
    }
    if (fromCart && getCartItems().length === 0) {
      router.replace("/cart");
      return;
    }
    setReady(true);
  }, [router, nextCheckout, fromCart]);

  const onPay = (event: FormEvent) => {
    event.preventDefault();
    createPendingFromCheckout({
      fromCart,
      productSlug,
      size
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
                <li key={`${item.product.slug}-${item.size}`}>
                  <div className="checkout-item-media">
                    <Image
                      src={item.product.imageSrc}
                      alt={item.product.name}
                      fill
                      sizes="88px"
                    />
                  </div>
                  <div className="checkout-item-copy">
                    <strong>{item.product.name}</strong>
                    <p className="muted checkout-meta">
                      {item.product.type}
                      {item.size ? ` · Size ${item.size}` : ""}
                      {item.quantity > 1 ? ` · Qty ${item.quantity}` : ""}
                    </p>
                    <div className="checkout-price-row">
                      <span>{formatPrice(item.total)}</span>
                      {item.product.compareAtPrice && (
                        <s>{formatPrice(parsePrice(item.product.compareAtPrice) * item.quantity)}</s>
                      )}
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
