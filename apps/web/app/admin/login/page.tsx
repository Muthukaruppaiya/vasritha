"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch, setAdminSession } from "../../../lib/admin-api";
import { OPS_PLATFORM_NAME } from "../../../lib/platform";

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

    const result = await adminFetch<{
      user: {
        id: string;
        email: string;
        fullName?: string;
        roles: string[];
        primaryRole: string | null;
        primaryRoleName: string | null;
      };
      session: { access_token: string };
    }>("/api/auth/login", {
      method: "POST",
      json: { email, password }
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
          Inventory, POS, orders, and staff tools. Customer brands (e.g. Vasritha) plug in separately.
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
