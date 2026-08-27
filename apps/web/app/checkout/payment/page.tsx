"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, Landmark, Smartphone } from "lucide-react";
import { Footer, Header } from "../../../components/storefront";
import { getAppliedCoupon, markVoucherUsed } from "../../../lib/applied-coupon";
import {
  buildOrderLines,
  finalizeLocalOrder,
  formatPrice,
  getPendingOrder,
  PlacedOrder
} from "../../../lib/order";
import { storeFetch } from "../../../lib/store-api";
import { getCustomerSession, isLoggedIn } from "../../../lib/customer-session";
import { useLocale } from "../../../lib/i18n/provider";
import { localizeProductFields, localizeSize } from "../../../lib/i18n/catalog-local";

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const methods = [
  {
    id: "upi",
    label: "UPI",
    detail: "GPay, PhonePe, Paytm & more",
    Icon: Smartphone
  },
  {
    id: "card",
    label: "Cards",
    detail: "Visa, Mastercard, RuPay",
    Icon: CreditCard
  },
  {
    id: "netbanking",
    label: "Netbanking",
    detail: "All major Indian banks",
    Icon: Landmark
  }
] as const;

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const [ready, setReady] = useState(false);
  const [method, setMethod] = useState<(typeof methods)[number]["id"]>("upi");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const pending = useMemo(() => (ready ? getPendingOrder() : null), [ready]);
  const lines = useMemo(() => (pending ? buildOrderLines(pending) : []), [pending]);
  const total = lines.reduce((sum, item) => sum + item.lineTotal, 0);
  const compareTotal = pending
    ? pending.items.reduce(
        (sum, item) => sum + (item.compareAtPrice || item.price) * item.quantity,
        0
      )
    : 0;
  const savings = Math.max(0, compareTotal - total);
  const pieceCount = lines.reduce((sum, item) => sum + item.quantity, 0);
  const backHref = searchParams.get("from") || "/checkout";
  const selected = methods.find((entry) => entry.id === method) ?? methods[0];
  const headlineItem = lines[0];
  const headlineLocalized = headlineItem
    ? localizeProductFields(
        {
          slug: headlineItem.slug,
          name: headlineItem.name,
          shortName: headlineItem.shortName || headlineItem.name,
          type: headlineItem.type
        },
        locale
      )
    : null;

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace(`/login?next=${encodeURIComponent("/checkout/payment")}`);
      return;
    }
    const order = getPendingOrder();
    if (!order?.items?.length || !order.shippingAddressId) {
      router.replace("/checkout");
      return;
    }
    setReady(true);
  }, [router]);

  const completePaidOrder = (
    pendingOrder: NonNullable<ReturnType<typeof getPendingOrder>>,
    session: NonNullable<ReturnType<typeof getCustomerSession>>,
    createdOrder: { id: string; order_number?: string; created_at?: string }
  ) => {
    const placed: PlacedOrder = {
      id: createdOrder.id,
      orderNumber: createdOrder.order_number || createdOrder.id,
      createdAt: createdOrder.created_at || new Date().toISOString(),
      paymentMethod: method,
      paymentStatus: "paid",
      total,
      savings: Math.max(
        0,
        pendingOrder.items.reduce(
          (sum, item) => sum + ((item.compareAtPrice || item.price) - item.price) * item.quantity,
          0
        )
      ),
      customer: {
        name: session.name,
        email: session.email,
        phone: session.phone
      },
      address: { ...session.address },
      items: lines
    };

    finalizeLocalOrder(placed, pendingOrder.fromCart);
    const used = getAppliedCoupon();
    if (used) markVoucherUsed(used.id);
    router.replace(`/checkout/confirmation?order=${encodeURIComponent(placed.orderNumber)}`);
  };

  const onPay = async () => {
    setError("");
    setProcessing(true);

    const pendingOrder = getPendingOrder();
    const session = getCustomerSession();
    if (!pendingOrder || !session) {
      setProcessing(false);
      setError("Checkout session expired. Please try again.");
      return;
    }

    const created = await storeFetch<{
      order: { id: string; order_number?: string; created_at?: string; total_amount?: string };
      items: unknown[];
    }>("/api/customer/orders", {
      method: "POST",
      json: {
        shippingAddressId: pendingOrder.shippingAddressId,
        items: pendingOrder.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId || undefined,
          quantity: item.quantity
        })),
        couponCode: getAppliedCoupon()?.code,
        sessionKey:
          typeof window !== "undefined" ? window.localStorage.getItem("vasritha_cart_session") : null
      }
    });

    if (created.error || !created.data?.order?.id) {
      setProcessing(false);
      setError(created.error || "Could not create order");
      return;
    }

    const payment = await storeFetch<{
      mode?: string;
      paymentId: string;
      razorpayOrderId?: string;
      orderId: string;
      keyId?: string | null;
      amount?: string;
      currency?: string;
    }>("/api/payments/create", {
      method: "POST",
      json: {
        orderId: created.data.order.id,
        method
      }
    });

    if (payment.error || !payment.data?.paymentId) {
      setProcessing(false);
      setError(payment.error || "Could not start payment");
      return;
    }

    const finishVerify = async (payload: Record<string, unknown>) => {
      const verified = await storeFetch("/api/payments/verify", {
        method: "POST",
        json: {
          orderId: created.data!.order.id,
          paymentId: payment.data!.paymentId,
          sessionKey: typeof window !== "undefined" ? window.localStorage.getItem("vasritha_cart_session") : null,
          ...payload
        }
      });
      if (verified.error) {
        setProcessing(false);
        setError(verified.error);
        return;
      }
      completePaidOrder(pendingOrder, session, created.data!.order);
    };

    // Demo path when Razorpay keys are not configured
    if (payment.data.mode === "test" || !payment.data.keyId) {
      await finishVerify({
        razorpayOrderId: payment.data.razorpayOrderId,
        testSuccess: true
      });
      return;
    }

    const readyRzp = await loadRazorpayScript();
    if (!readyRzp || !window.Razorpay) {
      setProcessing(false);
      setError("Could not load Razorpay Checkout");
      return;
    }

    const amount = Number(payment.data.amount ?? created.data.order.total_amount ?? total);
    const razorpay = new window.Razorpay({
      key: payment.data.keyId,
      amount: Math.round(amount * 100),
      currency: payment.data.currency || "INR",
      name: "Vasritha",
      description: created.data.order.order_number || "Order payment",
      order_id: payment.data.razorpayOrderId,
      prefill: {
        name: session.name,
        email: session.email,
        contact: session.phone
      },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        await finishVerify({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature
        });
      },
      modal: {
        ondismiss: () => {
          setProcessing(false);
          setError("Payment cancelled. Your order is pending — try again to complete payment.");
        }
      }
    });
    razorpay.open();
  };

  if (!ready || !pending) {
    return (
      <main className="pay-page" data-reveal>
        <div className="shell section pay-page-inner">
          <p className="muted">Opening Razorpay test checkout…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="pay-page" data-reveal>
      <div className="shell section pay-page-inner">
        <nav className="pay-progress" aria-label="Checkout progress">
          <span>Summary</span>
          <span className="is-current">Payment</span>
          <span>Confirmed</span>
        </nav>

        <header className="pay-hero">
          <p className="eyebrow">Razorpay · Secure checkout</p>
          <h1>Complete payment</h1>
          <p className="muted pay-lead">Choose a method, then confirm. Live keys open Razorpay Checkout.</p>
        </header>

        <div className="pay-amount" aria-live="polite">
          <div className="pay-amount-top">
            <span>Amount due</span>
            {savings > 0 ? <em className="pay-amount-save">You save {formatPrice(savings)}</em> : null}
          </div>
          <div className="pay-amount-price">
            <strong>{formatPrice(total)}</strong>
            {compareTotal > total ? <s>{formatPrice(compareTotal)}</s> : null}
          </div>
          {headlineLocalized ? (
            <p className="pay-amount-product">
              <strong>{headlineLocalized.shortName}</strong>
              {lines.length > 1
                ? ` · +${lines.length - 1} more`
                : headlineLocalized.name !== headlineLocalized.shortName
                  ? ` · ${headlineLocalized.name}`
                  : ""}
            </p>
          ) : null}
          <p className="pay-amount-meta">
            {pieceCount} {pieceCount === 1 ? "piece" : "pieces"} · Paying with {selected.label}
          </p>
        </div>

        <div className="pay-layout">
          <section className="pay-panel" aria-label="Payment methods">
            <div className="pay-panel-head">
              <p className="pay-kicker">Payment</p>
              <h2>Select method</h2>
              <p className="muted">Tap a method, then confirm below</p>
            </div>

            <div className="pay-method-list" role="radiogroup" aria-label="Choose payment method">
              {methods.map((entry) => {
                const Icon = entry.Icon;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="radio"
                    aria-checked={method === entry.id}
                    className={`pay-method${method === entry.id ? " is-active" : ""}`}
                    onClick={() => setMethod(entry.id)}
                    disabled={processing}
                  >
                    <span className="pay-method-mark" aria-hidden="true">
                      <Icon size={20} strokeWidth={1.75} />
                    </span>
                    <span className="pay-method-copy">
                      <strong>{entry.label}</strong>
                      <em>{entry.detail}</em>
                    </span>
                    <span className="pay-method-check" aria-hidden="true" />
                  </button>
                );
              })}
            </div>

            {error && <p className="pay-error">{error}</p>}

            <div className="pay-actions">
              <button type="button" className="btn pay-confirm" onClick={onPay} disabled={processing}>
                {processing ? "Processing…" : `Pay ${formatPrice(total)}`}
              </button>
              <Link className="pay-back" href={backHref}>
                Back to order summary
              </Link>
            </div>
          </section>

          <aside className="pay-receipt" aria-label="Order receipt">
            <div className="pay-receipt-head">
              <p className="pay-kicker">Order receipt</p>
              <h2>Paying for</h2>
            </div>

            <ul className="pay-receipt-list">
              {lines.map((item) => {
                const localized = localizeProductFields(
                  {
                    slug: item.slug,
                    name: item.name,
                    shortName: item.shortName || item.name,
                    type: item.type
                  },
                  locale
                );
                const sizeLabel = localizeSize(item.size, locale);
                return (
                  <li key={`${item.productId}-${item.size}`} className="pay-receipt-item">
                    <div className="pay-receipt-media">
                      <Image src={item.imageSrc} alt={localized.name} fill sizes="80px" />
                    </div>
                    <div className="pay-receipt-copy">
                      <strong>{localized.shortName}</strong>
                      {localized.name !== localized.shortName ? (
                        <p className="pay-receipt-fullname">{localized.name}</p>
                      ) : null}
                      <p className="muted">
                        Size {sizeLabel}
                        {item.quantity > 1 ? ` · Qty ${item.quantity}` : ""}
                      </p>
                      <div className="pay-receipt-price">
                        <span>{formatPrice(item.lineTotal)}</span>
                        {item.compareAtPrice ? <s>{item.compareAtPrice}</s> : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="pay-receipt-total">
              <span>Total payable</span>
              <strong>{formatPrice(total)}</strong>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <main className="pay-page">
            <div className="shell section pay-page-inner">
              <p className="muted">Loading payment…</p>
            </div>
          </main>
        }
      >
        <PaymentContent />
      </Suspense>
      <Footer />
    </>
  );
}
