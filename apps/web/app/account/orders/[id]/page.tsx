"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Footer, Header } from "../../../../components/storefront";
import { isLoggedIn } from "../../../../lib/customer-session";
import { storeFetch } from "../../../../lib/store-api";

type OrderDetail = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: string;
  tax_amount: string;
  shipping_amount: string;
  total_amount: string;
  created_at: string;
  order_items: Array<{
    id: string;
    product_name: string;
    variant_name: string | null;
    sku: string | null;
    unit_price: string;
    quantity: number;
    line_total: string;
  }>;
  shipping_address: {
    recipient_name: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postal_code: string;
    country?: string;
  } | null;
  payment: {
    provider: string;
    provider_payment_id: string | null;
    amount: string;
    status: string;
  } | null;
};

const TRACK_STEPS = [
  { key: "pending", label: "Order placed", hint: "We received your order" },
  { key: "confirmed", label: "Confirmed", hint: "Payment verified" },
  { key: "processing", label: "Preparing", hint: "Boutique packing in progress" },
  { key: "shipped", label: "Shipped", hint: "On the way to you" },
  { key: "delivered", label: "Delivered", hint: "Enjoy your Vasritha piece" }
] as const;

const STATUS_RANK: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  shipped: 3,
  delivered: 4,
  cancelled: -1
};

function formatMoney(value: string | number) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function AccountOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace(`/login?next=/account/orders/${params.id}`);
      return;
    }

    void (async () => {
      const result = await storeFetch<OrderDetail>(`/api/customer/orders/${params.id}`);
      if (result.error || !result.data) {
        setError(result.error || "Order not found");
        setLoading(false);
        return;
      }
      setOrder(result.data);
      setLoading(false);
    })();
  }, [params.id, router]);

  const activeRank = useMemo(() => {
    if (!order) return 0;
    return STATUS_RANK[order.status] ?? 0;
  }, [order]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="shell section account-page">
          <p className="muted">Loading order…</p>
        </main>
        <Footer />
      </>
    );
  }

  if (error || !order) {
    return (
      <>
        <Header />
        <main className="shell section account-page">
          <p className="admin-alert admin-alert--error">{error || "Order not found"}</p>
          <Link href="/account" className="account-btn">
            Back to account
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  const cancelled = order.status === "cancelled";

  return (
    <>
      <Header />
      <main className="shell section account-page">
        <nav className="account-crumbs">
          <Link href="/account">Your account</Link>
          <span>/</span>
          <Link href="/account/orders">Your orders</Link>
          <span>/</span>
          <span>{order.order_number}</span>
        </nav>

        <header className="account-hero account-hero--compact">
          <div>
            <p className="eyebrow">Order details</p>
            <h1>{order.order_number}</h1>
            <p className="muted">Placed on {formatDate(order.created_at)}</p>
          </div>
          <strong className={`account-status account-status--${order.status}`}>
            {order.status.replace(/_/g, " ")}
          </strong>
        </header>

        <section className="account-panel">
          <div className="account-panel-head">
            <h2>Tracking</h2>
          </div>
          {cancelled ? (
            <p className="account-cancelled">This order was cancelled.</p>
          ) : (
            <ol className="account-track">
              {TRACK_STEPS.map((step, index) => {
                const done = activeRank >= index;
                const current = activeRank === index;
                return (
                  <li
                    key={step.key}
                    className={`account-track-step${done ? " is-done" : ""}${current ? " is-current" : ""}`}
                  >
                    <span className="account-track-dot" aria-hidden="true" />
                    <div>
                      <strong>{step.label}</strong>
                      <p className="muted">{step.hint}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="account-detail-layout">
          <section className="account-panel">
            <div className="account-panel-head">
              <h2>Items</h2>
            </div>
            <ul className="account-item-list">
              {order.order_items.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.product_name}</strong>
                    <p className="muted">
                      {item.variant_name || "Free Size"}
                      {item.sku ? ` · ${item.sku}` : ""} · Qty {item.quantity}
                    </p>
                  </div>
                  <strong>{formatMoney(item.line_total)}</strong>
                </li>
              ))}
            </ul>
            <div className="account-totals">
              <div>
                <span>Subtotal</span>
                <span>{formatMoney(order.subtotal)}</span>
              </div>
              <div>
                <span>Shipping</span>
                <span>{formatMoney(order.shipping_amount)}</span>
              </div>
              <div>
                <span>Tax</span>
                <span>{formatMoney(order.tax_amount)}</span>
              </div>
              <div className="account-totals-grand">
                <span>Order total</span>
                <strong>{formatMoney(order.total_amount)}</strong>
              </div>
            </div>
          </section>

          <aside className="account-side">
            <section className="account-panel">
              <div className="account-panel-head">
                <h2>Delivery</h2>
              </div>
              {order.shipping_address ? (
                <p>
                  <strong>{order.shipping_address.recipient_name}</strong>
                  <br />
                  {order.shipping_address.line1}
                  {order.shipping_address.line2 ? `, ${order.shipping_address.line2}` : ""}
                  <br />
                  {order.shipping_address.city}, {order.shipping_address.state}{" "}
                  {order.shipping_address.postal_code}
                  <br />
                  {order.shipping_address.phone}
                </p>
              ) : (
                <p className="muted">No shipping address on file for this order.</p>
              )}
            </section>

            <section className="account-panel">
              <div className="account-panel-head">
                <h2>Payment</h2>
              </div>
              <p>
                Status: <strong>{order.payment_status}</strong>
                <br />
                {order.payment?.provider ? (
                  <>
                    Provider: {order.payment.provider}
                    {order.payment.provider_payment_id ? (
                      <>
                        <br />
                        Ref: {order.payment.provider_payment_id}
                      </>
                    ) : null}
                  </>
                ) : (
                  "Payment details will appear once processed."
                )}
              </p>
            </section>
          </aside>
        </div>

        <div className="account-order-actions" style={{ marginTop: 18 }}>
          <Link href="/account#orders" className="account-btn account-btn--ghost">
            Back to orders
          </Link>
          <Link href="/collections" className="account-btn">
            Continue shopping
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
