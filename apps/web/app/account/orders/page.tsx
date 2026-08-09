"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, UserRound } from "lucide-react";
import { Footer, Header } from "../../../components/storefront";
import { isLoggedIn } from "../../../lib/customer-session";
import { storeFetch } from "../../../lib/store-api";
import { useT } from "../../../lib/i18n/provider";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: string;
  created_at: string;
  order_items?: Array<{
    product_name: string;
    quantity: number;
    line_total: string;
  }>;
};

function formatMoney(value: string | number) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function AccountOrdersPage() {
  const t = useT();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login?next=/account/orders");
      return;
    }
    setReady(true);

    void (async () => {
      const ordersRes = await storeFetch<OrderRow[]>("/api/customer/orders");
      if (ordersRes.error) setError(ordersRes.error);
      setOrders(ordersRes.data || []);
      setLoadingOrders(false);
    })();
  }, [router]);

  if (!ready) {
    return (
      <>
        <Header />
        <main className="account-page">
          <div className="shell account-page-inner">
            <p className="muted">{t("account.loadingAccount")}</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="account-page">
        <div className="account-page-glow" aria-hidden />
        <div className="shell account-page-inner">
          <nav className="account-crumbs">
            <Link href="/account">{t("account.yourAccount")}</Link>
            <span>/</span>
            <span>{t("account.yourOrders")}</span>
          </nav>

          <section className="account-panel account-panel--orders" data-reveal>
            <div className="account-panel-head">
              <div>
                <p className="account-panel-kicker">{t("account.orders")}</p>
                <h2>{t("account.yourOrders")}</h2>
              </div>
              {orders.length > 0 ? (
                <span className="account-count-pill">{orders.length} total</span>
              ) : null}
            </div>

            {loadingOrders && <p className="muted">{t("account.loadingOrders")}</p>}
            {error ? <p className="admin-alert admin-alert--error">{error}</p> : null}
            {!loadingOrders && !orders.length && (
              <div className="account-empty">
                <span className="account-empty-icon" aria-hidden>
                  <Package size={32} strokeWidth={1.4} />
                </span>
                <p>{t("account.noOrdersYet")}</p>
                <p className="muted">{t("account.exploreCollection")}</p>
                <Link className="btn" href="/collections">
                  {t("common.continueShopping")}
                </Link>
              </div>
            )}

            <div className="account-order-list">
              {orders.map((order) => {
                const itemCount =
                  order.order_items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;
                const preview = order.order_items?.[0]?.product_name;
                return (
                  <article key={order.id} className="account-order-card">
                    <div className="account-order-meta">
                      <div>
                        <span className="account-label">{t("account.orderPlaced")}</span>
                        <strong>{formatDate(order.created_at)}</strong>
                      </div>
                      <div>
                        <span className="account-label">{t("account.total")}</span>
                        <strong>{formatMoney(order.total_amount)}</strong>
                      </div>
                      <div>
                        <span className="account-label">{t("account.orderNumber")}</span>
                        <strong>{order.order_number}</strong>
                      </div>
                      <div>
                        <span className="account-label">{t("account.status")}</span>
                        <strong className={`account-status-pill account-status-pill--${order.status}`}>
                          {statusLabel(order.status)}
                        </strong>
                      </div>
                    </div>
                    <div className="account-order-body">
                      <div className="account-order-preview">
                        <span className="account-order-thumb" aria-hidden>
                          <UserRound size={18} strokeWidth={1.5} />
                        </span>
                        <div>
                          <p>
                            {preview || t("account.orderFallback")}
                            {itemCount > 1 ? ` · ${itemCount}` : ""}
                          </p>
                          <p className="muted">
                            {t("account.payment")}: {statusLabel(order.payment_status)}
                          </p>
                        </div>
                      </div>
                      <div className="account-order-actions">
                        <Link href={`/account/orders/${order.id}`} className="account-btn">
                          {t("account.trackPackage")}
                        </Link>
                        <Link
                          href={`/account/orders/${order.id}`}
                          className="account-btn account-btn--ghost"
                        >
                          {t("account.viewOrder")}
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
