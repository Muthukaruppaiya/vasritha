"use client";

const TOKEN_KEY = "vasritha_customer_token";
const USER_KEY = "vasritha_customer_user";
const ADDRESS_KEY = "vasritha_customer_address";

export type StoreSessionUser = {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  roles?: string[];
};

export type StoreAddress = {
  id: string;
  recipient_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
  is_default?: boolean;
};

export function getStoreToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoreUser(): StoreSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoreSessionUser) : null;
  } catch {
    return null;
  }
}

export function getCachedAddress(): StoreAddress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ADDRESS_KEY);
    return raw ? (JSON.parse(raw) as StoreAddress) : null;
  } catch {
    return null;
  }
}

export function setStoreSession(token: string, user: StoreSessionUser) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function setCachedAddress(address: StoreAddress) {
  window.localStorage.setItem(ADDRESS_KEY, JSON.stringify(address));
}

export function clearStoreSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(ADDRESS_KEY);
}

export async function storeFetch<T = unknown>(
  path: string,
  options: RequestInit & { json?: unknown } = {}
): Promise<{ data?: T; error?: string; status: number }> {
  const token = getStoreToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      status: res.status,
      error: (payload as { error?: string }).error || res.statusText || "Request failed"
    };
  }

  return {
    status: res.status,
    data: (payload as { data: T }).data
  };
}

export async function storeLogin(email: string, password: string) {
  const result = await storeFetch<{
    user: {
      id: string;
      email: string;
      fullName?: string;
      roles?: string[];
    };
    session: { access_token: string };
  }>("/api/auth/login", { method: "POST", json: { email, password } });

  if (result.error || !result.data?.session?.access_token) {
    return { error: result.error || "Login failed" };
  }

  setStoreSession(result.data.session.access_token, {
    id: result.data.user.id,
    email: result.data.user.email,
    fullName: result.data.user.fullName,
    roles: result.data.user.roles
  });

  return { data: result.data };
}

export async function storeRegister(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}) {
  const result = await storeFetch<{
    user: { id: string; email: string; fullName?: string };
    session: { access_token: string };
  }>("/api/auth/register", { method: "POST", json: input });

  if (result.error || !result.data?.session?.access_token) {
    return { error: result.error || "Registration failed" };
  }

  setStoreSession(result.data.session.access_token, {
    id: result.data.user.id,
    email: result.data.user.email,
    fullName: result.data.user.fullName || input.fullName,
    phone: input.phone
  });

  return { data: result.data };
}
