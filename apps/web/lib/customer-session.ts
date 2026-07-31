export type CustomerSession = {
  name: string;
  email: string;
  phone: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
};

const SESSION_KEY = "vasritha_customer";

export function getRawCustomerSession(): Partial<CustomerSession> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<CustomerSession>;
  } catch {
    return null;
  }
}

export function getCustomerSession(): CustomerSession | null {
  const parsed = getRawCustomerSession();
  if (!parsed?.email || !parsed?.address?.line1) return null;
  return parsed as CustomerSession;
}

export function isLoggedIn() {
  const parsed = getRawCustomerSession();
  return Boolean(parsed?.email);
}

export function getCustomerProfile(): Pick<CustomerSession, "name" | "email" | "phone"> | null {
  const parsed = getRawCustomerSession();
  if (!parsed?.email) return null;
  return {
    name: parsed.name || "",
    email: parsed.email,
    phone: parsed.phone || ""
  };
}

export function hasSavedAddress() {
  const session = getCustomerSession();
  return Boolean(session?.address?.line1 && session?.address?.city && session?.address?.pincode);
}

export function saveCustomerSession(session: CustomerSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearCustomerSession() {
  window.localStorage.removeItem(SESSION_KEY);
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
