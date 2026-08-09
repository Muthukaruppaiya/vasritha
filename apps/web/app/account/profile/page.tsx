"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Footer, Header } from "../../../components/storefront";
import {
  getCachedAddress,
  getCustomerProfile,
  isLoggedIn
} from "../../../lib/customer-session";
import { storeFetch } from "../../../lib/store-api";
import { useT } from "../../../lib/i18n/provider";

export default function AccountProfilePage() {
  const t = useT();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<{ name: string; email: string; phone: string } | null>(null);
  const [address, setAddress] = useState<ReturnType<typeof getCachedAddress>>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login?next=/account/profile");
      return;
    }

    const local = getCustomerProfile();
    setProfile(local);
    setAddress(getCachedAddress());
    setReady(true);

    void (async () => {
      const [profileRes, addressRes] = await Promise.all([
        storeFetch<{ full_name: string; email: string; phone: string | null }>("/api/customer/profile"),
        storeFetch<
          Array<{
            id: string;
            line1: string;
            line2?: string | null;
            city: string;
            state: string;
            postal_code: string;
            is_default?: boolean;
          }>
        >("/api/customer/addresses")
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
            <span>{t("account.profile")}</span>
          </nav>

          <section className="account-panel account-panel--profile" data-reveal>
            <div className="account-panel-head">
              <div>
                <p className="account-panel-kicker">{t("account.profile")}</p>
                <h2>{t("account.accountDetails")}</h2>
              </div>
              <Link href="/account/address?next=/account/profile" className="account-panel-link">
                <Pencil size={14} />
                {t("account.editAddress")}
              </Link>
            </div>

            <div className="account-detail-grid account-detail-grid--stack">
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
              <div className="account-detail-cell">
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
                    <Link href="/account/address?next=/account/profile">{t("account.addOne")}</Link>
                  </strong>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
