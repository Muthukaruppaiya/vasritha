import { NextResponse } from "next/server";
import { isHostedRuntime } from "./runtime";

const DEV_JWT_FALLBACK = "vasritha-local-dev-secret-change-me";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function pruneBuckets(now: number) {
  if (buckets.size < 4000) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
  if (buckets.size > 8000) buckets.clear();
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  pruneBuckets(now);
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count += 1;
  return { ok: true };
}

export function tooManyRequests(
  retryAfter: number,
  message = "Too many attempts. Please wait a moment and try again."
) {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) }
    }
  );
}

/** Production must not use the local JWT fallback. */
export function requireJwtSecret() {
  const raw = String(process.env.JWT_SECRET || "").trim();
  if (isHostedRuntime()) {
    if (!raw || raw === DEV_JWT_FALLBACK || raw.length < 32) {
      throw new Error(
        "JWT_SECRET must be a unique value of at least 32 characters in production."
      );
    }
    return raw;
  }
  return raw || DEV_JWT_FALLBACK;
}

export function clipText(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), payment=(self), geolocation=(self)",
  "X-DNS-Prefetch-Control": "on",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
};

export function applySecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  if (isHostedRuntime()) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return response;
}
