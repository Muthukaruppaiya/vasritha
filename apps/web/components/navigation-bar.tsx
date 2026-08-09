"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { useLocale, useT } from "../lib/i18n/provider";
import { localizeCategoryName } from "../lib/i18n/catalog-local";

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavigationBar({
  categories
}: {
  categories?: Array<{ slug: string; name: string; description?: string }>;
} = {}) {
  const t = useT();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const titleId = useId();
  const [brandLogo, setBrandLogo] = useState("/vasritha-logo.png");
  const [whatsappHref, setWhatsappHref] = useState<string | null>(null);
  const [shopLinks, setShopLinks] = useState<Array<{ href: string; label: string; hint: string; slug: string }>>(
    () =>
      (categories || []).map((category) => ({
        href: `/${category.slug}`,
        slug: category.slug,
        label: category.name,
        hint: category.description || ""
      }))
  );

  const discoverLinks = useMemo(
    () => [
      { href: "/", label: t("common.home") },
      { href: "/collections", label: t("common.allCollections") }
    ],
    [t]
  );

  const offerLink = useMemo(
    () => ({ href: "/checkout", label: t("common.offers") }),
    [t]
  );

  const accountLinks = useMemo(
    () => [{ href: "/account", label: t("common.myAccount") }],
    [t]
  );

  useEffect(() => {
    if (categories?.length) {
      setShopLinks(
        categories.map((category) => ({
          href: `/${category.slug}`,
          slug: category.slug,
          label: category.name,
          hint: category.description || ""
        }))
      );
      return;
    }

    fetch("/api/categories")
      .then((res) => res.json())
      .then((payload) => {
        const rows = (payload?.data || []) as Array<{ slug: string; name: string; description?: string }>;
        setShopLinks(
          rows.map((category) => ({
            href: `/${category.slug}`,
            slug: category.slug,
            label: category.name,
            hint: category.description || ""
          }))
        );
      })
      .catch(() => setShopLinks([]));
  }, [categories]);

  useEffect(() => {
    fetch("/api/site-branding")
      .then((res) => res.json())
      .then((payload) => {
        const path = payload?.data?.logoPath as string | undefined;
        if (path) setBrandLogo(path);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/integrations/public")
      .then((res) => res.json())
      .then((payload) => {
        const wa = payload?.data?.whatsapp as
          | { enabled?: boolean; phoneNumber?: string | null; prefillMessage?: string | null }
          | undefined;
        if (!wa?.enabled || !wa.phoneNumber) {
          setWhatsappHref(null);
          return;
        }
        const href = wa.prefillMessage
          ? `https://wa.me/${wa.phoneNumber}?text=${encodeURIComponent(wa.prefillMessage)}`
          : `https://wa.me/${wa.phoneNumber}`;
        setWhatsappHref(href);
      })
      .catch(() => setWhatsappHref(null));
  }, []);

  const localizedShopLinks = useMemo(
    () =>
      shopLinks.map((link) => ({
        ...link,
        label: localizeCategoryName(link.slug, locale, link.label)
      })),
    [shopLinks, locale]
  );

  const desktopLinks = useMemo(
    () => [
      ...discoverLinks,
      ...localizedShopLinks.map(({ href, label }) => ({ href, label })),
      offerLink
    ],
    [localizedShopLinks, discoverLinks, offerLink]
  );

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
    <nav className="header-nav" aria-label={t("nav.primary")}>
      <button
        className="nav-trigger"
        type="button"
        aria-label={t("nav.open")}
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
        aria-label={t("nav.close")}
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
            <img className="drawer-brand-mark" src={brandLogo} alt="" />
            <span>
              <span className="drawer-brand-eyebrow">{t("nav.boutique")}</span>
              <span id={titleId} className="drawer-brand-name">
                Vasritha
              </span>
            </span>
          </Link>
          <button
            className="drawer-close"
            type="button"
            aria-label={t("nav.foldAway")}
            onClick={() => setOpen(false)}
          >
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
            <p className="drawer-group-label">{t("nav.discover")}</p>
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
            <p className="drawer-group-label">{t("nav.shop")}</p>
            <div className="drawer-links drawer-links--shop">
              {localizedShopLinks.map((link, index) => (
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
            <p className="drawer-group-label">{t("nav.account")}</p>
            <div className="drawer-links">
              {[offerLink, ...accountLinks].map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={isActivePath(pathname, link.href) ? "is-active" : undefined}
                  style={{ "--i": index + discoverLinks.length + localizedShopLinks.length } as CSSProperties}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="drawer-foot">
          <p>{t("nav.needAdvice")}</p>
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              {t("nav.chatWhatsapp")}
            </a>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
