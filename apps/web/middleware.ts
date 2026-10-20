import { NextRequest, NextResponse } from "next/server";
import {
  classifyHost,
  getOpsPublicUrl,
  getStorefrontPublicUrl,
  isOpsOnlyPath,
  isOpsPath,
  isPassthroughPath
} from "./lib/hosts";
import { applySecurityHeaders } from "./lib/security";

/**
 * Domain split:
 * - Vasritha hosts → customer storefront only (no /admin)
 * - Sukadhaa hosts → ops/admin only (root → /admin)
 * - localhost → both (no gating)
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPassthroughPath(pathname)) {
    return applySecurityHeaders(NextResponse.next());
  }

  const hostHeader =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const role = classifyHost(hostHeader);

  // Dev / unset hosts: keep single-origin behaviour
  if (role === "local") return applySecurityHeaders(NextResponse.next());

  if (role === "storefront") {
    if (isOpsOnlyPath(pathname)) {
      const target = new URL(`${getOpsPublicUrl()}${pathname}${search}`);
      return applySecurityHeaders(NextResponse.redirect(target, 308));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  if (role === "ops") {
    // Clean ops home: sukadhaa.in/ → admin
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return applySecurityHeaders(NextResponse.rewrite(url));
    }

    if (isOpsPath(pathname)) {
      return applySecurityHeaders(NextResponse.next());
    }

    // Storefront pages on ops host → send shoppers to Vasritha
    const target = new URL(`${getStorefrontPublicUrl()}${pathname}${search}`);
    return applySecurityHeaders(NextResponse.redirect(target, 308));
  }

  // Unknown production host: refuse to mix surfaces
  if (isOpsOnlyPath(pathname)) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL(`${getOpsPublicUrl()}${pathname}${search}`), 308)
    );
  }
  return applySecurityHeaders(
    NextResponse.redirect(new URL(`${getStorefrontPublicUrl()}${pathname}${search}`), 308)
  );
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static files already covered in isPassthroughPath.
     * Keep matcher broad so host rules apply to pages + APIs.
     */
    "/((?!_next/static|_next/image).*)"
  ]
};
