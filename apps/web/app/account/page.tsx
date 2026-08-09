"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Package, LogOut, ChevronRight, UserRound } from "lucide-react";
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
  const [orderCount, setOrderCount] = useState(0);
  const [activeShipments, setActiveShipments] = useState(0);

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
        storeFetch<Array<{ id: string; is_default?: boolean }>>("/api/customer/addresses"),
        storeFetch<Array<{ status: string }>>("/api/customer/orders")
      ]);

      if (profileRes.data) {
        setProfile({
          name: profileRes.data.full_name || local?.name || "",
          email: profileRes.data.email || local?.email || "",
          phone: profileRes.data.phone || local?.phone || ""
        });
      }

      if (addressRes.data?.length) {
        setAddress(addressRes.data[0]);
      } else {
        setAddress(null);
      }

      const orders = ordersRes.data || [];
      setOrderCount(orders.length);
      setActiveShipments(
        orders.filter((o) => ["confirmed", "processing", "shipped"].includes(o.status)).length
      );
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

  const firstName = (profile?.name || "there").split(" ")[0];

  return (
    <>
      <Header />
      <main className="account-page">
        <div className="account-page-glow" aria-hidden />
        <div className="shell account-page-inner">
          <header className="account-hero account-hero--simple" data-reveal>
            <div className="account-hero-main">
              <div className="account-avatar" aria-hidden>
                {initials(profile?.name)}
              </div>
              <h1>
                {t("account.hello")}, {firstName}
              </h1>
            </div>
          </header>

          <div className="account-stats" data-reveal data-reveal-delay="1">
            <div className="account-stat">
              <span className="account-stat-value">{orderCount}</span>
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

          <div className="account-grid account-grid--hub" data-reveal data-reveal-delay="2">
            <Link href="/account/profile" className="account-tile">
              <span className="account-tile-icon account-tile-icon--security">
                <UserRound size={22} strokeWidth={1.6} />
              </span>
              <div>
                <strong>{t("account.profile")}</strong>
                <span>{t("account.accountDetails")}</span>
              </div>
              <ChevronRight className="account-tile-chevron" size={18} />
            </Link>
            <Link href="/account/orders" className="account-tile">
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
          </div>

          <div className="account-signout-wrap" data-reveal>
            <button type="button" className="account-signout account-signout--footer" onClick={signOut}>
              <LogOut size={16} />
              {t("account.signOut")}
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
