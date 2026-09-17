"use client";

import Link from "next/link";
import { TicketPercent } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CART_EVENT, getCartCount } from "../lib/cart";
import {
  COUPON_EVENT,
  applySavedVoucher,
  getAppliedCoupon,
  getSavedVouchers,
  type SavedVoucher
} from "../lib/applied-coupon";
import { CUSTOMER_AUTH_EVENT } from "../lib/customer-auth-event";
import { isLoggedIn } from "../lib/customer-session";
import { useLocale, useT } from "../lib/i18n/provider";
import { localizeOfferMessage } from "../lib/i18n/cms-local";
import { fetchPublicJson } from "../lib/public-fetch-cache";
import { CartBagIcon, LoginIcon } from "./icons";
import { LanguageSwitcher } from "./language-switcher";
import { NavigationBar } from "./navigation-bar";
import { SiteSearch } from "./site-search";

export function Header({
  categories
}: {
  categories?: Array<{
    slug: string;
    name: string;
    description?: string;
    nameI18n?: Record<string, string>;
  }>;
} = {}) {
  const t = useT();
  const { locale } = useLocale();
  const menuRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [bagCount, setBagCount] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);
  const [headerLogo, setHeaderLogo] = useState("/vasritha-logo.png");
  const [offerMessages, setOfferMessages] = useState<string[] | null>(null);
  const [vouchers, setVouchers] = useState<SavedVoucher[]>([]);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [voucherPulse, setVoucherPulse] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    fetchPublicJson<{ data?: { headerLogoPath?: string } }>("/api/site-branding")
      .then((payload) => {
        const path = payload?.data?.headerLogoPath;
        if (path) setHeaderLogo(path);
      })
      .catch(() => undefined);

    fetchPublicJson<{ data?: { offers?: Array<{ message: string }> } }>("/api/homepage-config")
      .then((payload) => {
        const rows = payload?.data?.offers || [];
        if (rows.length) setOfferMessages(rows.map((row) => row.message));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const sync = () => setBagCount(getCartCount());
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const syncCoupon = () => {
      const nextVouchers = getSavedVouchers();
      const applied = getAppliedCoupon();
      setVouchers(nextVouchers);
      setAppliedCode((prev) => {
        const next = applied?.code || null;
        if (next && next !== prev) {
          setVoucherPulse(true);
          window.setTimeout(() => setVoucherPulse(false), 1200);
        }
        return next;
      });
    };
    syncCoupon();
    window.addEventListener(COUPON_EVENT, syncCoupon);
    window.addEventListener("storage", syncCoupon);
    return () => {
      window.removeEventListener(COUPON_EVENT, syncCoupon);
      window.removeEventListener("storage", syncCoupon);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    const syncAuth = () => setLoggedIn(isLoggedIn());
    syncAuth();
    window.addEventListener(CUSTOMER_AUTH_EVENT, syncAuth);
    window.addEventListener("storage", syncAuth);
    window.addEventListener("focus", syncAuth);
    return () => {
      window.removeEventListener(CUSTOMER_AUTH_EVENT, syncAuth);
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("focus", syncAuth);
    };
  }, []);

  const fallbackOffers = [t("offers.firstOrder"), t("offers.freeShipping"), t("offers.jewelryOffer")];
  const offers = (offerMessages?.length ? offerMessages : fallbackOffers).map((message) =>
    localizeOfferMessage(locale, message)
  );
  const availableCount = vouchers.filter((row) => row.status === "available").length;

  return (
    <div className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="topbar" aria-label="Current Vasritha offers">
        <div className="offer-track">
          {offers.map((message) => (
            <span key={`live-${message}`}>{message}</span>
          ))}
          {offers.map((message) => (
            <span key={`dup-${message}`} aria-hidden="true">
              {message}
            </span>
          ))}
        </div>
      </div>
      <header className="shell nav">
        <div className="nav-left">
          <NavigationBar categories={categories} />
          <SiteSearch className="search-link--mobile" />
        </div>

        <Link className="nav-logo-link" href="/" aria-label="Vasritha home">
          <span className="nav-logo-mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src={headerLogo} alt="Vasritha — Timeless Elegance" />
          </span>
        </Link>

        <div className="actions">
          <div className="actions-cluster actions-cluster--utility">
            <LanguageSwitcher />
            <SiteSearch className="search-link--desktop" />
          </div>

          <div className="actions-cluster actions-cluster--commerce">
            <div className="voucher-menu" ref={menuRef}>
              <button
                id="header-voucher-dock"
                type="button"
                className={`icon-link nav-icon-btn voucher-dock${availableCount ? " has-voucher" : ""}${voucherPulse ? " is-pulse" : ""}`}
                aria-label={
                  availableCount
                    ? `Gift vouchers, ${availableCount} available`
                    : "Gift vouchers"
                }
                aria-expanded={menuOpen}
                aria-haspopup="true"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <TicketPercent size={21} strokeWidth={1.7} />
                {availableCount ? (
                  <span className="voucher-dock-count" aria-hidden="true">
                    {availableCount > 9 ? "9+" : availableCount}
                  </span>
                ) : null}
              </button>

              {menuOpen ? (
                <div className="voucher-menu-panel" role="menu">
                  <div className="voucher-menu-head">
                    <p className="voucher-menu-title">Your vouchers</p>
                    {availableCount ? (
                      <span className="voucher-menu-chip">{availableCount} ready</span>
                    ) : null}
                  </div>
                  {!vouchers.length ? (
                    <p className="voucher-menu-empty">
                      No vouchers yet. Scratch a gift card when it appears on the storefront.
                    </p>
                  ) : (
                    <ul className="voucher-menu-list">
                      {vouchers.map((row) => (
                        <li key={row.id}>
                          <div className="voucher-menu-row">
                            <div>
                              <strong>{row.code}</strong>
                              <span>
                                {row.headline || "Gift voucher"}
                                {row.status === "used" ? " · Used" : ""}
                                {appliedCode === row.code && row.status === "available"
                                  ? " · Applied"
                                  : ""}
                              </span>
                            </div>
                            {row.status === "available" ? (
                              <button
                                type="button"
                                className="voucher-menu-apply"
                                disabled={appliedCode === row.code}
                                onClick={() => {
                                  applySavedVoucher(row.id);
                                  setMenuOpen(false);
                                }}
                              >
                                {appliedCode === row.code ? "Applied" : "Apply"}
                              </button>
                            ) : (
                              <em className="voucher-menu-used">Used</em>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {availableCount ? (
                    <Link className="voucher-menu-cart" href="/cart" onClick={() => setMenuOpen(false)}>
                      Go to bag
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>

            <Link
              className="icon-link nav-icon-btn login-link"
              href={loggedIn ? "/account" : "/login"}
              aria-label={loggedIn ? t("common.yourAccount") : t("common.login")}
            >
              <LoginIcon size={21} />
            </Link>
            <Link
              className={`icon-link nav-icon-btn bag-link${bagCount ? " has-items" : ""}`}
              href="/cart"
              aria-label={`${t("common.bag")}, ${bagCount} ${t("common.bagItems")}`}
            >
              <CartBagIcon size={21} />
              <span>{bagCount}</span>
            </Link>
          </div>
        </div>
      </header>
    </div>
  );
}
