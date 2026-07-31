"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useEffect, useId, useState, type CSSProperties } from "react";
import { categories } from "../lib/mock-data";

const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919000000000";

const discoverLinks = [
  { href: "/", label: "Home" },
  { href: "/collections", label: "All Collections" }
];

const shopLinks = categories.map((category) => ({
  href: `/${category.slug}`,
  label: category.name,
  hint: category.description
}));

const accountLinks = [
  { href: "/checkout", label: "Offers" },
  { href: "/login", label: "Login" }
];

const desktopLinks = [
  ...discoverLinks,
  ...shopLinks.map(({ href, label }) => ({ href, label })),
  ...accountLinks
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavigationBar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const titleId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <nav className="header-nav" aria-label="Primary navigation">
      <button
        className="nav-trigger"
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="site-nav-drawer"
        onClick={() => setOpen(true)}
      >
        <Menu size={22} />
      </button>

      <div className="menu-bar" aria-label="Desktop menu">
        {desktopLinks.map((link) => (
          <Link
            key={link.href + link.label}
            href={link.href}
            className={isActivePath(pathname, link.href) ? "is-active" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <button
        className={`nav-backdrop${open ? " is-open" : ""}`}
        type="button"
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      <div
        id="site-nav-drawer"
        className={`nav-drawer${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!open}
      >
        <div className="drawer-atmosphere" aria-hidden="true" />

        <div className="drawer-head">
          <Link href="/" className="drawer-brand" onClick={() => setOpen(false)}>
            <img className="drawer-brand-mark" src="/vasritha-logo.png" alt="" />
            <span>
              <span className="drawer-brand-eyebrow">Boutique</span>
              <span id={titleId} className="drawer-brand-name">Vasritha</span>
            </span>
          </Link>
          <button className="drawer-close" type="button" aria-label="Fold the menu away" onClick={() => setOpen(false)}>
            <span className="drawer-close-mark" aria-hidden="true">
              <span />
              <span />
            </span>
            <span className="drawer-close-copy">
              <em>Fold</em>
              <strong>away</strong>
            </span>
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-group">
            <p className="drawer-group-label">Discover</p>
            <div className="drawer-links">
              {discoverLinks.map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={isActivePath(pathname, link.href) ? "is-active" : undefined}
                  style={{ "--i": index } as CSSProperties}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="drawer-group">
            <p className="drawer-group-label">Shop</p>
            <div className="drawer-links drawer-links--shop">
              {shopLinks.map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={isActivePath(pathname, link.href) ? "is-active" : undefined}
                  style={{ "--i": index + discoverLinks.length } as CSSProperties}
                  onClick={() => setOpen(false)}
                >
                  <span>{link.label}</span>
                  <small>{link.hint}</small>
                </Link>
              ))}
            </div>
          </div>

          <div className="drawer-group">
            <p className="drawer-group-label">Account</p>
            <div className="drawer-links">
              {accountLinks.map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={isActivePath(pathname, link.href) ? "is-active" : undefined}
                  style={{ "--i": index + discoverLinks.length + shopLinks.length } as CSSProperties}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="drawer-foot">
          <p>Need styling advice?</p>
          <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer">
            Chat on WhatsApp
          </a>
        </div>
      </div>
    </nav>
  );
}
