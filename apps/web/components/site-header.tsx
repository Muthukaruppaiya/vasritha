"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { CART_EVENT, getCartCount } from "../lib/cart";
import { CUSTOMER_AUTH_EVENT } from "../lib/customer-auth-event";
import { isLoggedIn } from "../lib/customer-session";
import { useT } from "../lib/i18n/provider";
import { CartBagIcon, LoginIcon } from "./icons";
import { LanguageSwitcher } from "./language-switcher";
import { NavigationBar } from "./navigation-bar";

export function Header({
  categories
}: {
  categories?: Array<{ slug: string; name: string; description?: string }>;
} = {}) {
  const t = useT();
  const [scrolled, setScrolled] = useState(false);
  const [bagCount, setBagCount] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  return (
    <div className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="topbar" aria-label="Current Vasritha offers">
        <div className="offer-track">
          <span>{t("offers.firstOrder")}</span>
          <span>{t("offers.freeShipping")}</span>
          <span>{t("offers.jewelryOffer")}</span>
          <span aria-hidden="true">{t("offers.firstOrder")}</span>
          <span aria-hidden="true">{t("offers.freeShipping")}</span>
          <span aria-hidden="true">{t("offers.jewelryOffer")}</span>
        </div>
      </div>
      <header className="shell nav">
        <div className="nav-left">
          <NavigationBar categories={categories} />
          <Link className="search-link search-link--mobile" href="/sarees" aria-label={t("common.search")}>
            <Search size={21} strokeWidth={1.7} />
          </Link>
        </div>
        <Link className="nav-logo-link" href="/" aria-label="Vasritha home">
          <img className="brand-logo" src="/vasritha-logo-header.png" alt="Vasritha — Timeless Elegance" />
        </Link>
        <div className="actions">
          <LanguageSwitcher />
          <Link className="search-link search-link--desktop" href="/sarees" aria-label={t("common.search")}>
            <Search size={21} strokeWidth={1.7} />
          </Link>
          <Link
            className="icon-link login-link"
            href={loggedIn ? "/account" : "/login"}
            aria-label={loggedIn ? t("common.yourAccount") : t("common.login")}
          >
            <LoginIcon size={22} />
          </Link>
          <Link
            className="icon-link bag-link"
            href="/cart"
            aria-label={`${t("common.bag")}, ${bagCount} ${t("common.bagItems")}`}
          >
            <CartBagIcon size={22} />
            <span>{bagCount}</span>
          </Link>
        </div>
      </header>
    </div>
  );
}
