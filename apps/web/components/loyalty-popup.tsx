"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CUSTOMER_AUTH_EVENT } from "../lib/customer-auth-event";
import { isLoggedIn } from "../lib/customer-session";
import { getStoreToken, storeFetch } from "../lib/store-api";

type PopupConfig = {
  enabled: boolean;
  title: string;
  message: string;
  image_path: string | null;
  guest_cta_label: string;
  guest_cta_href: string;
  login_cta_label: string;
  member_cta_label: string;
  member_cta_href: string;
  delay_ms: number;
  show_once_per_session: boolean;
  homepage_only: boolean;
  benefit_teaser: string | null;
};

type MemberLoyalty = {
  points_balance?: number;
  primary_prompt?: string | null;
};

const SESSION_KEY = "vasritha_loyalty_popup_dismissed";
const SKIP_PREFIXES = ["/admin", "/login", "/account/register", "/checkout"];

function mediaSrc(path: string | null) {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("/")) return path;
  return `/${path.replace(/^\//, "")}`;
}

function wasDismissedThisSession() {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissedThisSession() {
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

function voucherOverlayOpen() {
  return Boolean(document.querySelector(".voucher-overlay"));
}

function pathAllowed(pathname: string | null, homepageOnly: boolean) {
  if (!pathname) return false;
  if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  if (homepageOnly) return pathname === "/";
  return true;
}

export function LoyaltyPopup() {
  const pathname = usePathname();
  const [config, setConfig] = useState<PopupConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [member, setMember] = useState<MemberLoyalty | null>(null);

  useEffect(() => {
    const syncAuth = () => setLoggedIn(isLoggedIn());
    syncAuth();
    window.addEventListener(CUSTOMER_AUTH_EVENT, syncAuth);
    window.addEventListener("storage", syncAuth);
    return () => {
      window.removeEventListener(CUSTOMER_AUTH_EVENT, syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/admin")) return;

    let cancelled = false;
    let showTimer: number | undefined;
    let waitTimer: number | undefined;

    const clearTimers = () => {
      if (showTimer) window.clearTimeout(showTimer);
      if (waitTimer) window.clearTimeout(waitTimer);
    };

    void (async () => {
      try {
        const res = await fetch("/api/loyalty/popup", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { data?: PopupConfig | null };
        const data = json.data;
        if (!data?.enabled || cancelled) return;

        if (data.show_once_per_session && wasDismissedThisSession()) return;
        if (!pathAllowed(window.location.pathname, data.homepage_only)) return;

        setConfig(data);

        const tryShow = () => {
          if (cancelled) return;
          if (voucherOverlayOpen()) {
            waitTimer = window.setTimeout(tryShow, 1200);
            return;
          }
          if (!pathAllowed(window.location.pathname, data.homepage_only)) return;
          setOpen(true);
          if (data.show_once_per_session) markDismissedThisSession();
        };

        showTimer = window.setTimeout(tryShow, Math.max(0, data.delay_ms || 0));
      } catch {
        /* silent */
      }
    })();

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (!open || !loggedIn || !getStoreToken()) {
      setMember(null);
      return;
    }
    let cancelled = false;
    void storeFetch<MemberLoyalty>("/api/customer/loyalty").then((result) => {
      if (cancelled || result.error || !result.data) return;
      setMember(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, loggedIn]);

  useEffect(() => {
    if (!open || !config) return;
    if (!pathAllowed(pathname, config.homepage_only)) {
      setOpen(false);
    }
  }, [pathname, open, config]);

  if (!open || !config || pathname?.startsWith("/admin")) return null;

  const image = mediaSrc(config.image_path);
  const memberPrompt = member?.primary_prompt?.trim() || null;
  const teaser = config.benefit_teaser?.trim() || null;

  const close = () => {
    markDismissedThisSession();
    setOpen(false);
  };

  const loginHref = `/login?next=${encodeURIComponent(config.member_cta_href || "/account")}`;

  return (
    <div
      className="loyalty-popup-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loyalty-popup-title"
    >
      <button type="button" className="loyalty-popup-backdrop" aria-label="Close" onClick={close} />
      <div className="loyalty-popup">
        <button type="button" className="loyalty-popup-close" onClick={close} aria-label="Close">
          ×
        </button>

        {image ? (
          <div className="loyalty-popup-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="loyalty-popup-image" />
          </div>
        ) : null}

        <div className="loyalty-popup-body">
          <p className="loyalty-popup-eyebrow">Loyalty</p>
          <h2 id="loyalty-popup-title">{config.title}</h2>
          <p className="loyalty-popup-message">{config.message}</p>

          {loggedIn ? (
            <div className="loyalty-popup-member">
              {typeof member?.points_balance === "number" ? (
                <p className="loyalty-popup-points">
                  Your points: <strong>{member.points_balance}</strong>
                </p>
              ) : null}
              {memberPrompt ? <p className="loyalty-popup-teaser">{memberPrompt}</p> : null}
              {!memberPrompt && teaser ? <p className="loyalty-popup-teaser">{teaser}</p> : null}
            </div>
          ) : teaser ? (
            <p className="loyalty-popup-teaser">{teaser}</p>
          ) : null}

          <div className="loyalty-popup-actions">
            {loggedIn ? (
              <Link className="btn" href={config.member_cta_href} onClick={close}>
                {config.member_cta_label}
              </Link>
            ) : (
              <>
                <Link className="btn" href={config.guest_cta_href} onClick={close}>
                  {config.guest_cta_label}
                </Link>
                <Link className="loyalty-popup-secondary" href={loginHref} onClick={close}>
                  {config.login_cta_label}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
