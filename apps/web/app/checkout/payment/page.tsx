"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Footer, Header } from "../../../components/storefront";
import { isLoggedIn } from "../../../lib/customer-session";
import {
  buildOrderLines,
  formatPrice,
  getPendingOrder,
  placeOrder
} from "../../../lib/order";

const methods = [
  {
    id: "upi",
    mark: "UPI",
    label: "UPI",
    detail: "GPay, PhonePe, Paytm & more"
  },
  {
    id: "card",
    mark: "CD",
    label: "Cards",
    detail: "Visa, Mastercard, RuPay"
  },
  {
    id: "netbanking",
    mark: "NB",
    label: "Netbanking",
    detail: "All major Indian banks"
  }
] as const;

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [method, setMethod] = useState<(typeof methods)[number]["id"]>("upi");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const pending = useMemo(() => (ready ? getPendingOrder() : null), [ready]);
  const lines = useMemo(
    () => (pending ? buildOrderLines(pending.items) : []),
    [pending]
  );
  const total = lines.reduce((sum, item) => sum + item.lineTotal, 0);
  const pieceCount = lines.reduce((sum, item) => sum + item.quantity, 0);
  const backHref = searchParams.get("from") || "/checkout";
  const selected = methods.find((entry) => entry.id === method) ?? methods[0];

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace(`/account/register?next=${encodeURIComponent("/checkout/payment")}`);
      return;
    }
    const order = getPendingOrder();
    if (!order?.items?.length) {
      router.replace("/checkout");
      return;
    }
    setReady(true);
  }, [router]);

  const onPay = () => {
    setError("");
    setProcessing(true);
    window.setTimeout(() => {
      const order = placeOrder(method);
      if (!order) {
        setProcessing(false);
        setError("Payment could not be completed. Please try again.");
        return;
      }
      router.replace(`/checkout/confirmation?order=${encodeURIComponent(order.id)}`);
    }, 1400);
  };

  if (!ready || !pending) {
    return (
      <main className="shell section pay-page" data-reveal>
        <p className="muted">Opening Razorpay test checkout…</p>
      </main>
    );
  }

  return (
    <main className="shell section pay-page" data-reveal>
      <div className="pay-progress" aria-label="Checkout progress">
        <span>Summary</span>
        <span className="is-current">Payment</span>
        <span>Confirmed</span>
      </div>

      <header className="pay-hero">
        <p className="eyebrow">Razorpay · Secure test</p>
        <h1>Complete payment</h1>
        <p className="muted pay-lead">
          Choose how you would like to pay. This is a demo — no real charge is made.
        </p>
      </header>

      <div className="pay-amount" aria-live="polite">
        <span>Amount due</span>
        <strong>{formatPrice(total)}</strong>
        <em>
          {pieceCount} {pieceCount === 1 ? "piece" : "pieces"} · {selected.label}
        </em>
      </div>

      <div className="pay-layout">
        <section className="pay-panel" aria-label="Payment methods">
          <div className="pay-panel-head">
            <h2>Select method</h2>
            <p className="muted">Tap a method to continue</p>
          </div>

          <div className="pay-method-list" role="radiogroup" aria-label="Choose payment method">
            {methods.map((entry) => (
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
                  {entry.mark}
                </span>
                <span className="pay-method-copy">
                  <strong>{entry.label}</strong>
                  <em>{entry.detail}</em>
                </span>
                <span className="pay-method-check" aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="pay-test-note">
            <span className="pay-test-pill">Test mode</span>
            <p>No real charge will be made. Success is simulated for Vasritha checkout.</p>
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
            <p className="eyebrow">Order receipt</p>
            <h2>Paying for</h2>
          </div>

          <ul className="pay-receipt-list">
            {lines.map((item) => (
              <li key={`${item.slug}-${item.size}`} className="pay-receipt-item">
                <div className="pay-receipt-media">
                  <Image src={item.imageSrc} alt={item.name} fill sizes="72px" />
                </div>
                <div className="pay-receipt-copy">
                  <strong>{item.name}</strong>
                  <p className="muted">
                    Size {item.size}
                    {item.quantity > 1 ? ` · Qty ${item.quantity}` : ""}
                  </p>
                  <span>{formatPrice(item.lineTotal)}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="pay-receipt-total">
            <span>Total payable</span>
            <strong>{formatPrice(total)}</strong>
          </div>
        </aside>
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
          <main className="shell section pay-page">
            <p className="muted">Loading payment…</p>
          </main>
        }
      >
        <PaymentContent />
      </Suspense>
      <Footer />
    </>
  );
}
