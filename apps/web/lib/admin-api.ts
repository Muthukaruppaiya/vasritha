"use client";

const TOKEN_KEY = "vasritha_admin_token";
const USER_KEY = "vasritha_admin_user";
const ACTIVITY_KEY = "vasritha_admin_activity_at";

/** In-store staff idle timeout (5 minutes). */
export const ADMIN_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export type AdminSessionUser = {
  id: string;
  email: string;
  fullName?: string;
  roles: string[];
  permissions?: string[];
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
  touchAdminActivity();
}

export function clearAdminSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(ACTIVITY_KEY);
}

export function touchAdminActivity() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const last = Number(window.localStorage.getItem(ACTIVITY_KEY) || 0);
  // Throttle writes — activity only needs ~1s resolution for a 5-minute idle window.
  if (Number.isFinite(last) && now - last < 1000) return;
  window.localStorage.setItem(ACTIVITY_KEY, String(now));
}

export function getAdminLastActivityAt() {
  if (typeof window === "undefined") return 0;
  const raw = Number(window.localStorage.getItem(ACTIVITY_KEY) || 0);
  return Number.isFinite(raw) ? raw : 0;
}

export function isAdminSessionIdleExpired(now = Date.now()) {
  const last = getAdminLastActivityAt();
  if (!last) return true;
  return now - last >= ADMIN_IDLE_TIMEOUT_MS;
}

export async function refreshAdminSession(): Promise<boolean> {
  const token = getAdminToken();
  if (!token) return false;
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = (await res.json().catch(() => null)) as {
      data?: {
        user: AdminSessionUser;
        session: { access_token: string };
      };
      error?: string;
    } | null;
    if (!res.ok || !payload?.data?.session?.access_token) return false;
    setAdminSession(payload.data.session.access_token, {
      ...payload.data.user,
      permissions: payload.data.user.permissions
    });
    return true;
  } catch {
    return false;
  }
}

export async function adminFetch<T = unknown>(
  path: string,
  options: RequestInit & { json?: unknown } = {}
): Promise<{ data?: T; error?: string; status: number }> {
  touchAdminActivity();
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

export async function adminUpload<T = unknown>(path: string, formData: FormData) {
  touchAdminActivity();
  const token = getAdminToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, {
    method: "POST",
    headers,
    body: formData
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      status: res.status,
      error: (payload as { error?: string }).error || res.statusText || "Upload failed"
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
