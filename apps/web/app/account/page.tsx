"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Package,
  LogOut,
  ChevronRight,
  UserRound,
  Truck,
  ShieldCheck,
  Pencil
} from "lucide-react";
import { Footer, Header } from "../../components/storefront";
import {
  clearCustomerSession,
  getCachedAddress,
  getCustomerProfile,
  isLoggedIn
} from "../../lib/customer-session";
import { storeFetch } from "../../lib/store-api";
import { CUSTOMER_AUTH_EVENT } from "../../lib/customer-auth-event";
import { useT } from "../../lib/i18n/provider";

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

function initials(name?: string) {
  if (!name?.trim()) return "V";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "V";
}

export default function AccountPage() {
  const t = useT();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<{ name: string; email: string; phone: string } | null>(null);
  const [address, setAddress] = useState<ReturnType<typeof getCachedAddress>>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login?next=/account");
      return;
    }

    const local = getCustomerProfile();
    setProfile(local);
    setAddress(getCachedAddress());
    setReady(true);

    void (async () => {
      const [profileRes, addressRes, ordersRes] = await Promise.all([
        storeFetch<{ full_name: string; email: string; phone: string | null }>("/api/customer/profile"),
        storeFetch<
          Array<{
            id: string;
            recipient_name: string;
            phone: string;
            line1: string;
            line2?: string | null;
            city: string;
            state: string;
            postal_code: string;
            is_default?: boolean;
          }>
        >("/api/customer/addresses"),
        storeFetch<OrderRow[]>("/api/customer/orders")
      ]);

      if (profileRes.data) {
        setProfile({
          name: profileRes.data.full_name || local?.name || "",
          email: profileRes.data.email || local?.email || "",
          phone: profileRes.data.phone || local?.phone || ""
        });
      }

      if (addressRes.data?.length) {
        const preferred = addressRes.data.find((row) => row.is_default) || addressRes.data[0];
        setAddress(preferred);
      }

      if (ordersRes.error) setError(ordersRes.error);
      setOrders(ordersRes.data || []);
      setLoadingOrders(false);
    })();
  }, [router]);

  const signOut = () => {
    clearCustomerSession();
    window.dispatchEvent(new Event(CUSTOMER_AUTH_EVENT));
    router.push("/login");
  };

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

  const recentOrders = orders.slice(0, 5);
  const activeShipments = orders.filter((o) =>
    ["confirmed", "processing", "shipped"].includes(o.status)
  ).length;
  const firstName = (profile?.name || "there").split(" ")[0];

  return (
    <>
      <Header />
      <main className="account-page">
        <div className="account-page-glow" aria-hidden />
        <div className="shell account-page-inner">
          <header className="account-hero" data-reveal>
            <div className="account-hero-main">
              <div className="account-avatar" aria-hidden>
                {initials(profile?.name)}
              </div>
              <div>
                <p className="eyebrow">{t("account.yourAccount")}</p>
                <h1>
                  {t("account.hello")}, {firstName}
                </h1>
                <p className="account-hero-copy">{t("account.manageLead")}</p>
              </div>
            </div>
            <button type="button" className="account-signout" onClick={signOut}>
              <LogOut size={16} />
              {t("account.signOut")}
            </button>
          </header>

          <div className="account-stats" data-reveal data-reveal-delay="1">
            <div className="account-stat">
              <span className="account-stat-value">{orders.length}</span>
              <span className="account-stat-label">{t("account.orders")}</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{activeShipments}</span>
              <span className="account-stat-label">{t("account.inTransit")}</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{address ? "1" : "0"}</span>
              <span className="account-stat-label">{t("account.addresses")}</span>
            </div>
          </div>

          <div className="account-grid" data-reveal data-reveal-delay="2">
            <Link href="#orders" className="account-tile">
              <span className="account-tile-icon account-tile-icon--orders">
                <Package size={22} strokeWidth={1.6} />
              </span>
              <div>
                <strong>{t("account.yourOrders")}</strong>
                <span>{t("account.ordersHint")}</span>
              </div>
              <ChevronRight className="account-tile-chevron" size={18} />
            </Link>
            <Link href="/account/address?next=/account" className="account-tile">
              <span className="account-tile-icon account-tile-icon--address">
                <MapPin size={22} strokeWidth={1.6} />
              </span>
              <div>
                <strong>{t("account.addresses")}</strong>
                <span>{t("account.addressesHint")}</span>
              </div>
              <ChevronRight className="account-tile-chevron" size={18} />
            </Link>
            <div className="account-tile account-tile--static">
              <span className="account-tile-icon account-tile-icon--security">
                <ShieldCheck size={22} strokeWidth={1.6} />
              </span>
              <div>
                <strong>{t("account.loginSecurity")}</strong>
                <span>{profile?.email}</span>
              </div>
            </div>
            <div className="account-tile account-tile--static">
              <span className="account-tile-icon account-tile-icon--track">
                <Truck size={22} strokeWidth={1.6} />
              </span>
              <div>
                <strong>{t("account.trackPackages")}</strong>
                <span>
                  {orders.length
                    ? `${orders.length} ${t("account.orders").toLowerCase()}`
                    : t("account.noShipments")}
                </span>
              </div>
            </div>
          </div>

          <section className="account-panel account-panel--profile" data-reveal>
            <div className="account-panel-head">
              <div>
                <p className="account-panel-kicker">{t("account.profile")}</p>
                <h2>{t("account.accountDetails")}</h2>
              </div>
              <Link href="/account/address?next=/account" className="account-panel-link">
                <Pencil size={14} />
                {t("account.editAddress")}
              </Link>
            </div>
            <div className="account-detail-grid">
              <div className="account-detail-cell">
                <span className="account-label">{t("account.name")}</span>
                <strong>{profile?.name || "—"}</strong>
              </div>
              <div className="account-detail-cell">
                <span className="account-label">{t("auth.email")}</span>
                <strong>{profile?.email || "—"}</strong>
              </div>
              <div className="account-detail-cell">
                <span className="account-label">{t("account.phone")}</span>
                <strong>{profile?.phone || "—"}</strong>
              </div>
              <div className="account-detail-cell account-detail-cell--wide">
                <span className="account-label">{t("account.defaultAddress")}</span>
                {address ? (
                  <strong>
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ""}
                    <br />
                    {address.city}, {address.state} {address.postal_code}
                  </strong>
                ) : (
                  <strong>
                    {t("account.noAddress")}{" "}
                    <Link href="/account/address?next=/account">{t("account.addOne")}</Link>
                  </strong>
                )}
              </div>
            </div>
          </section>

          <section className="account-panel account-panel--orders" id="orders" data-reveal>
            <div className="account-panel-head">
              <div>
                <p className="account-panel-kicker">{t("account.orders")}</p>
                <h2>{t("account.yourOrders")}</h2>
              </div>
              {orders.length > 5 ? (
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
              {recentOrders.map((order) => {
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
                        <strong
                          className={`account-status-pill account-status-pill--${order.status}`}
                        >
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
