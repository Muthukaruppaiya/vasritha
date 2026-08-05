"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Footer, Header } from "../../../components/storefront";
import { localizeProductFields, localizeSize } from "../../../lib/i18n/catalog-local";
import { LOCALE_META } from "../../../lib/i18n/config";
import { useLocale, useT } from "../../../lib/i18n/provider";
import { formatPrice, getLastOrder, getOrderById, PlacedOrder } from "../../../lib/order";

function ConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order") || "";
  const t = useT();
  const { locale } = useLocale();
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
    return new Date(order.createdAt).toLocaleString(`${LOCALE_META[locale].htmlLang}-IN`, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }, [order, locale]);

  const methodLabel =
    order?.paymentMethod === "upi"
      ? t("checkout.methodUpi")
      : order?.paymentMethod === "card"
        ? t("checkout.methodCard")
        : order?.paymentMethod === "netbanking"
          ? t("checkout.methodNetbanking")
          : order?.paymentMethod || t("checkout.methodRazorpay");

  if (!ready || !order) {
    return (
      <main className="shell section confirm-page" data-reveal>
        <p className="muted">{t("checkout.preparingConfirmation")}</p>
      </main>
    );
  }

  const displayId = order.orderNumber || order.id;
  const firstName = order.customer.name.split(" ")[0] || order.customer.name;

  return (
    <main className="shell section confirm-page" data-reveal>
      <header className="confirm-hero">
        <p className="eyebrow">{t("checkout.orderConfirmed")}</p>
        <h1>{t("checkout.thankYouName", { name: firstName })}</h1>
        <p className="muted confirm-lead">
          {t("checkout.paymentSuccessful", { email: order.customer.email })}
        </p>
      </header>

      <div className="confirm-badge" role="status">
        <span className="confirm-check" aria-hidden="true">
          ✓
        </span>
        <div>
          <strong>{t("checkout.paymentReceived")}</strong>
          <p className="muted">
            {t("checkout.orderMeta", { id: displayId, date: placedOn })}
          </p>
        </div>
      </div>

      <div className="confirm-layout">
        <section className="confirm-panel">
          <h2>{t("checkout.orderDetails")}</h2>
          <ul className="confirm-items">
            {order.items.map((item) => {
              const localized = localizeProductFields(
                {
                  slug: item.slug,
                  name: item.name,
                  shortName: item.name,
                  type: item.type
                },
                locale
              );
              const sizeLabel = localizeSize(item.size, locale);
              const meta =
                item.quantity > 1
                  ? t("checkout.sizeQty", {
                      type: localized.type,
                      size: sizeLabel,
                      qty: item.quantity
                    })
                  : t("checkout.sizeOnly", {
                      type: localized.type,
                      size: sizeLabel
                    });

              return (
                <li key={`${item.productId}-${item.size}`}>
                  <div className="confirm-item-media">
                    <Image src={item.imageSrc} alt={localized.name} fill sizes="72px" />
                  </div>
                  <div className="confirm-item-copy">
                    <strong>{localized.name}</strong>
                    <p className="muted">{meta}</p>
                  </div>
                  <span>{formatPrice(item.lineTotal)}</span>
                </li>
              );
            })}
          </ul>

          <div className="confirm-totals">
            {order.savings > 0 && (
              <div className="confirm-total-line">
                <span>{t("checkout.youSaved")}</span>
                <strong>{formatPrice(order.savings)}</strong>
              </div>
            )}
            <div className="confirm-total-line confirm-total-strong">
              <span>{t("checkout.paidVia", { method: methodLabel })}</span>
              <strong>{formatPrice(order.total)}</strong>
            </div>
          </div>
        </section>

        <aside className="confirm-panel">
          <h2>{t("checkout.delivery")}</h2>
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
              {t("common.continueShopping")}
            </Link>
            <Link className="confirm-secondary" href="/collections">
              {t("checkout.browseCollections")}
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default function ConfirmationPage() {
  const t = useT();

  return (
    <>
      <Header />
      <Suspense
        fallback={
          <main className="shell section confirm-page">
            <p className="muted">{t("checkout.loadingConfirmation")}</p>
          </main>
        }
      >
        <ConfirmationContent />
      </Suspense>
      <Footer />
    </>
  );
}
