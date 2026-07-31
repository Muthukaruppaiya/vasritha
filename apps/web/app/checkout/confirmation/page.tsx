"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Footer, Header } from "../../../components/storefront";
import { formatPrice, getLastOrder, getOrderById, PlacedOrder } from "../../../lib/order";

function ConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order") || "";
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const found = orderId ? getOrderById(orderId) : getLastOrder();
    if (!found) {
      router.replace("/cart");
      return;
    }
    setOrder(found);
    setReady(true);
  }, [orderId, router]);

  const placedOn = useMemo(() => {
    if (!order) return "";
    return new Date(order.createdAt).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }, [order]);

  const methodLabel =
    order?.paymentMethod === "upi"
      ? "UPI"
      : order?.paymentMethod === "card"
        ? "Card"
        : order?.paymentMethod === "netbanking"
          ? "Netbanking"
          : order?.paymentMethod || "Razorpay";

  if (!ready || !order) {
    return (
      <main className="shell section confirm-page" data-reveal>
        <p className="muted">Preparing your confirmation…</p>
      </main>
    );
  }

  return (
    <main className="shell section confirm-page" data-reveal>
      <header className="confirm-hero">
        <p className="eyebrow">Order confirmed</p>
        <h1>Thank you, {order.customer.name.split(" ")[0]}.</h1>
        <p className="muted confirm-lead">
          Your payment was successful. A confirmation will be sent to {order.customer.email}.
        </p>
      </header>

      <div className="confirm-badge" role="status">
        <span className="confirm-check" aria-hidden="true">
          ✓
        </span>
        <div>
          <strong>Payment received</strong>
          <p className="muted">Order {order.id} · {placedOn}</p>
        </div>
      </div>

      <div className="confirm-layout">
        <section className="confirm-panel">
          <h2>Order details</h2>
          <ul className="confirm-items">
            {order.items.map((item) => (
              <li key={`${item.slug}-${item.size}`}>
                <div className="confirm-item-media">
                  <Image src={item.imageSrc} alt={item.name} fill sizes="72px" />
                </div>
                <div className="confirm-item-copy">
                  <strong>{item.name}</strong>
                  <p className="muted">
                    {item.type} · Size {item.size}
                    {item.quantity > 1 ? ` · Qty ${item.quantity}` : ""}
                  </p>
                </div>
                <span>{formatPrice(item.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <div className="confirm-totals">
            {order.savings > 0 && (
              <div className="confirm-total-line">
                <span>You saved</span>
                <strong>{formatPrice(order.savings)}</strong>
              </div>
            )}
            <div className="confirm-total-line confirm-total-strong">
              <span>Paid via {methodLabel}</span>
              <strong>{formatPrice(order.total)}</strong>
            </div>
          </div>
        </section>

        <aside className="confirm-panel">
          <h2>Delivery</h2>
          <p className="confirm-value">{order.customer.name}</p>
          <p className="muted confirm-meta">{order.customer.phone}</p>
          <p className="confirm-value">
            {order.address.line1}
            {order.address.line2 ? `, ${order.address.line2}` : ""}
          </p>
          <p className="muted confirm-meta">
            {order.address.city}, {order.address.state} {order.address.pincode}
          </p>

          <div className="confirm-actions">
            <Link className="btn" href="/">
              Continue shopping
            </Link>
            <Link className="confirm-secondary" href="/collections">
              Browse collections
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default function ConfirmationPage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <main className="shell section confirm-page">
            <p className="muted">Loading confirmation…</p>
          </main>
        }
      >
        <ConfirmationContent />
      </Suspense>
      <Footer />
    </>
  );
}
