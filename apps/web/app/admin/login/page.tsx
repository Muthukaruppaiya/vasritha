"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch, setAdminSession } from "../../../lib/admin-api";
import { OPS_PLATFORM_NAME } from "../../../lib/platform";

const DEVICE_KEY = "vasritha_staff_device_key";

function getOrCreateDeviceKey() {
  if (typeof window === "undefined") return "";
  let key = window.localStorage.getItem(DEVICE_KEY);
  if (!key) {
    key =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(DEVICE_KEY, key);
  }
  return key;
}

async function readGeo(): Promise<{ latitude: number | null; longitude: number | null }> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { latitude: null, longitude: null };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        }),
      () => resolve({ latitude: null, longitude: null }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
  });
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const deviceKey = getOrCreateDeviceKey();
    const geo = await readGeo();

    const result = await adminFetch<{
      user: {
        id: string;
        email: string;
        fullName?: string;
        roles: string[];
        permissions?: string[];
        primaryRole: string | null;
        primaryRoleName: string | null;
      };
      session: { access_token: string };
    }>("/api/auth/login", {
      method: "POST",
      json: {
        email,
        password,
        client: "staff",
        deviceKey,
        deviceLabel: typeof navigator !== "undefined" ? navigator.platform || "Store device" : "Store device",
        latitude: geo.latitude,
        longitude: geo.longitude
      }
    });

    setLoading(false);

    if (result.error || !result.data) {
      setError(result.error || "Login failed");
      return;
    }

    const roles = result.data.user.roles || [];
    if (!roles.some((role) => role !== "customer")) {
      setError("This account has no admin/staff role.");
      return;
    }

    setAdminSession(result.data.session.access_token, {
      id: result.data.user.id,
      email: result.data.user.email,
      fullName: result.data.user.fullName,
      roles,
      permissions: result.data.user.permissions,
      primaryRole: result.data.user.primaryRole,
      primaryRoleName: result.data.user.primaryRoleName
    });

    router.replace("/admin");
  };

  return (
    <main className="admin-login">
      <section className="admin-login-card">
        <div className="eyebrow">{OPS_PLATFORM_NAME}</div>
        <h1>Sign in to operations</h1>
        <p className="muted">
          Staff / POS login only (not the public website). Sessions auto-lock after 5 minutes of
          inactivity. Extra login security can be turned on/off in Settings while you test.
        </p>

        <form className="admin-form" onSubmit={onSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && <p className="admin-error">{error}</p>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
