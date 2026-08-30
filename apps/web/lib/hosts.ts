/**
 * Host / domain helpers for storefront (Vasritha) vs ops (Sukadhaa).
 *
 * Production example:
 *   STOREFRONT_HOSTS=vasritha.in,www.vasritha.in
 *   OPS_HOSTS=sukadhaa.in,www.sukadhaa.in
 *   NEXT_PUBLIC_SITE_URL=https://vasritha.in
 *   OPS_PUBLIC_URL=https://sukadhaa.in
 *
 * Localhost skips host gating so / and /admin both work on one port.
 */

export type HostRole = "storefront" | "ops" | "local" | "unknown";

function splitHosts(raw: string | undefined): string[] {
  return String(raw || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
    .map((h) => h.replace(/:\d+$/, ""));
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
  return splitHosts(process.env.STOREFRONT_HOSTS);
}

export function getOpsHosts(): string[] {
  return splitHosts(process.env.OPS_HOSTS);
}

/** Canonical customer website URL (Vasritha). */
export function getStorefrontPublicUrl(): string {
  return (
    String(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

/** Canonical ops URL (Sukadhaa admin). */
export function getOpsPublicUrl(): string {
  return (
    String(process.env.OPS_PUBLIC_URL || "").replace(/\/$/, "") ||
    getStorefrontPublicUrl()
  );
}

export function classifyHost(hostRaw: string | null | undefined): HostRole {
  const host = normalizeHost(hostRaw);
  if (!host) return "unknown";
  if (isLocalDevHost(host)) return "local";

  const storefront = getStorefrontHosts();
  const ops = getOpsHosts();

  // No lists configured → treat as local (no gating)
  if (!storefront.length && !ops.length) return "local";

  if (ops.includes(host)) return "ops";
  if (storefront.includes(host)) return "storefront";
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
