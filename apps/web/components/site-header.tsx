"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { CartBagIcon, LoginIcon } from "./icons";
import { NavigationBar } from "./navigation-bar";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="topbar" aria-label="Current Vasritha offers">
        <div className="offer-track">
          <span>FLAT 10% OFF ON YOUR FIRST ORDER — USE WELCOME10</span>
          <span>COMPLIMENTARY SHIPPING ON ORDERS ABOVE ₹2,500</span>
          <span>GET 15% OFF ON JEWELRY ABOVE ₹4,999 — USE SHINE15</span>
          <span aria-hidden="true">FLAT 10% OFF ON YOUR FIRST ORDER — USE WELCOME10</span>
          <span aria-hidden="true">COMPLIMENTARY SHIPPING ON ORDERS ABOVE ₹2,500</span>
          <span aria-hidden="true">GET 15% OFF ON JEWELRY ABOVE ₹4,999 — USE SHINE15</span>
        </div>
      </div>
      <header className="shell nav">
        <div className="nav-left">
          <NavigationBar />
          <Link className="search-link search-link--mobile" href="/sarees" aria-label="Search catalog"><Search size={21} strokeWidth={1.7} /></Link>
        </div>
        <Link className="nav-logo-link" href="/" aria-label="Vasritha home">
          <img className="brand-logo" src="/vasritha-logo.png" alt="Vasritha — Timeless Elegance" />
        </Link>
        <div className="actions">
          <Link className="search-link search-link--desktop" href="/sarees" aria-label="Search catalog"><Search size={21} strokeWidth={1.7} /></Link>
          <Link className="icon-link login-link" href="/login" aria-label="Login to your account">
            <LoginIcon size={22} />
          </Link>
          <Link className="icon-link bag-link" href="/cart" aria-label="Shopping bag, 0 items">
            <CartBagIcon size={22} />
            <span>0</span>
          </Link>
        </div>
      </header>
    </div>
  );
}
