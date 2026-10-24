"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { fetchPublicJson } from "../lib/public-fetch-cache";
import "./storefront-coming-soon.css";

type Branding = {
  siteName?: string;
  logoPath?: string;
  headerLogoPath?: string;
  comingSoon?: boolean;
  comingSoonTitle?: string;
  comingSoonMessage?: string;
  comingSoonMediaUrl?: string | null;
};

function isVideoUrl(url: string) {
  return /\.(mp4|webm)(\?|$)/i.test(url);
}

function isOpsSurface(pathname: string | null) {
  if (!pathname) return false;
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/part/")
  );
}

export function StorefrontComingSoonGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const skip = isOpsSurface(pathname);
  const [branding, setBranding] = useState<Branding | null | undefined>(skip ? null : undefined);

  useEffect(() => {
    if (skip) return;
    let cancelled = false;
    fetchPublicJson<{ data?: Branding }>("/api/site-branding", 10_000)
      .then((payload) => {
        if (!cancelled) setBranding(payload?.data || null);
      })
      .catch(() => {
        if (!cancelled) setBranding(null);
      });
    return () => {
      cancelled = true;
    };
  }, [skip]);

  if (skip) return children;
  if (branding === undefined) {
    return <div className="coming-soon coming-soon--boot" aria-hidden />;
  }
  if (!branding?.comingSoon) return children;

  const logo = branding.headerLogoPath || branding.logoPath || "/vasritha-logo.png";
  const title = branding.comingSoonTitle || "Stocking up";
  const message =
    branding.comingSoonMessage || "We're filling the racks. Vasritha will be ready soon.";

  return (
    <main className="coming-soon" role="main">
      <div className="coming-soon__card">
        <img className="coming-soon__logo" src={logo} alt={branding.siteName || "Vasritha"} />
        <p className="coming-soon__eyebrow">Vasritha</p>
        <h1>{title}</h1>
        <p className="coming-soon__copy">{message}</p>

        {branding.comingSoonMediaUrl ? (
          <div className="coming-soon__media-wrap">
            {isVideoUrl(branding.comingSoonMediaUrl) ? (
              <video
                className="coming-soon__media"
                src={branding.comingSoonMediaUrl}
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <img className="coming-soon__media" src={branding.comingSoonMediaUrl} alt="" />
            )}
          </div>
        ) : (
          <div className="coming-soon__stack" aria-hidden>
            <span className="coming-soon__box coming-soon__box--1" />
            <span className="coming-soon__box coming-soon__box--2" />
            <span className="coming-soon__box coming-soon__box--3" />
            <span className="coming-soon__box coming-soon__box--4" />
          </div>
        )}
        <p className="coming-soon__pulse">We’ll be with you shortly</p>
      </div>
    </main>
  );
}
