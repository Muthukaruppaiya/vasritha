"use client";

const TOKEN_KEY = "vasritha_admin_token";
const USER_KEY = "vasritha_admin_user";

export type AdminSessionUser = {
  id: string;
  email: string;
  fullName?: string;
  roles: string[];
  primaryRole: string | null;
  primaryRoleName: string | null;
};

export function getAdminToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getAdminUser(): AdminSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AdminSessionUser) : null;
  } catch {
    return null;
  }
}

export function setAdminSession(token: string, user: AdminSessionUser) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAdminSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export async function adminFetch<T = unknown>(
  path: string,
  options: RequestInit & { json?: unknown } = {}
): Promise<{ data?: T; error?: string; status: number }> {
  const token = getAdminToken();
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

export function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
