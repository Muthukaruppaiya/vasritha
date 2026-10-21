/**
 * Host / domain helpers for storefront (Vasritha) vs ops (Sukadhaa).
 *
 * vasritha.com / vasritha.in → customer website
 * sukadhaa.com / sukadhaa.in → operations / POS / admin
 *
 * Extra hosts can still be added with STOREFRONT_HOSTS / OPS_HOSTS.
 * Localhost skips host gating so / and /admin both work on one port.
 */

import { isHostedRuntime } from "./runtime";

export type HostRole = "storefront" | "ops" | "local" | "unknown";

const DEFAULT_STOREFRONT_HOSTS = [
  "vasritha.com",
  "www.vasritha.com",
  "vasritha.in",
  "www.vasritha.in"
];

const DEFAULT_OPS_HOSTS = [
  "sukadhaa.com",
  "www.sukadhaa.com",
  "sukadhaa.in",
  "www.sukadhaa.in"
];

function splitHosts(raw: string | undefined): string[] {
  return String(raw || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
    .map((h) => h.replace(/:\d+$/, ""));
}

function uniqueHosts(...groups: string[][]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const host of group) {
      if (!host || seen.has(host)) continue;
      seen.add(host);
      out.push(host);
    }
  }
  return out;
}

function hostMatches(host: string, list: string[]) {
  if (list.includes(host)) return true;
  return list.some((entry) => {
    const e = entry.replace(/^www\./, "");
    return host === e || host === `www.${e}` || host.endsWith(`.${e}`);
  });
}

export function normalizeHost(host: string | null | undefined): string {
  const raw = String(host || "")
    .trim()
    .toLowerCase()
    .split(",")[0]
    ?.trim() || "";
  // Strip port (localhost:3000 → localhost)
  return raw.replace(/:\d+$/, "");
}

export function isLocalDevHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local")
  );
}

export function getStorefrontHosts(): string[] {
  return uniqueHosts(splitHosts(process.env.STOREFRONT_HOSTS), DEFAULT_STOREFRONT_HOSTS);
}

export function getOpsHosts(): string[] {
  return uniqueHosts(splitHosts(process.env.OPS_HOSTS), DEFAULT_OPS_HOSTS);
}

/** Canonical customer website URL (Vasritha). */
export function getStorefrontPublicUrl(): string {
  return (
    String(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "") ||
    (isHostedRuntime() ? "https://vasritha.com" : "http://localhost:3000")
  );
}

/** Canonical ops URL (Sukadhaa admin). */
export function getOpsPublicUrl(): string {
  return (
    String(process.env.OPS_PUBLIC_URL || "").replace(/\/$/, "") ||
    (isHostedRuntime() ? "https://sukadhaa.com" : getStorefrontPublicUrl())
  );
}

export function classifyHost(hostRaw: string | null | undefined): HostRole {
  const host = normalizeHost(hostRaw);
  if (!host) return "unknown";
  if (isLocalDevHost(host)) return "local";

  const storefront = getStorefrontHosts();
  const ops = getOpsHosts();

  if (hostMatches(host, ops)) return "ops";
  if (hostMatches(host, storefront)) return "storefront";
  return "unknown";
}

/** Paths that must work on the ops host (Sukadhaa). */
export function isOpsPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/part-upload") ||
    pathname.startsWith("/api/media") ||
    pathname.startsWith("/part/")
  );
}

/** Paths that must never be served on the storefront host. */
export function isOpsOnlyPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin")
  );
}

/** Always pass through (assets / Next internals). */
export function isPassthroughPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.(?:ico|png|jpg|jpeg|gif|webp|svg|css|js|map|txt|woff2?)$/i.test(pathname)
  );
}
