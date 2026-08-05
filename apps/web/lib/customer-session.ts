"use client";

import {
  clearStoreSession,
  getCachedAddress,
  getStoreToken,
  getStoreUser,
  setCachedAddress,
  StoreAddress
} from "./store-api";

export { getCachedAddress } from "./store-api";

export type CustomerSession = {
  name: string;
  email: string;
  phone: string;
  address: {
    id?: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
};

export function isLoggedIn() {
  return Boolean(getStoreToken() && getStoreUser()?.email);
}

export function getCustomerProfile(): Pick<CustomerSession, "name" | "email" | "phone"> | null {
  const user = getStoreUser();
  if (!user?.email) return null;
  return {
    name: user.fullName || "",
    email: user.email,
    phone: user.phone || ""
  };
}

export function getRawCustomerSession(): Partial<CustomerSession> | null {
  const user = getStoreUser();
  if (!user?.email) return null;
  const address = getCachedAddress();
  return {
    name: user.fullName || "",
    email: user.email,
    phone: user.phone || "",
    address: address
      ? {
          id: address.id,
          line1: address.line1,
          line2: address.line2 || undefined,
          city: address.city,
          state: address.state,
          pincode: address.postal_code
        }
      : undefined
  };
}

export function getCustomerSession(): CustomerSession | null {
  const user = getStoreUser();
  const address = getCachedAddress();
  if (!user?.email || !address?.line1) return null;
  return {
    name: user.fullName || address.recipient_name || "",
    email: user.email,
    phone: user.phone || address.phone || "",
    address: {
      id: address.id,
      line1: address.line1,
      line2: address.line2 || undefined,
      city: address.city,
      state: address.state,
      pincode: address.postal_code
    }
  };
}

export function hasSavedAddress() {
  const address = getCachedAddress();
  return Boolean(address?.id && address.line1 && address.city && address.postal_code);
}

export function cacheAddressFromApi(address: StoreAddress) {
  setCachedAddress(address);
}

/** @deprecated Prefer JWT session helpers; kept for transitional callers */
export function saveCustomerSession(_session: CustomerSession) {
  // Address-only cache updates go through cacheAddressFromApi after API save.
}

export function clearCustomerSession() {
  clearStoreSession();
}

export function buildCheckoutPath(productSlug?: string, size?: string) {
  const params = new URLSearchParams();
  if (productSlug) params.set("product", productSlug);
  if (size) params.set("size", size);
  const query = params.toString();
  return query ? `/checkout?${query}` : "/checkout";
}

export function resolveAuthCheckoutPath(checkoutPath: string) {
  if (isLoggedIn() && hasSavedAddress()) return checkoutPath;
  if (isLoggedIn()) return `/account/address?next=${encodeURIComponent(checkoutPath)}`;
  return `/account/register?next=${encodeURIComponent(checkoutPath)}`;
}

export function resolveBuyPath(productSlug?: string, size?: string) {
  return resolveAuthCheckoutPath(buildCheckoutPath(productSlug, size));
}

export function resolveCartCheckoutPath() {
  return resolveAuthCheckoutPath("/checkout?from=cart");
}
