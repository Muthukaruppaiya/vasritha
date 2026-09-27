"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Footer, Header } from "../../components/storefront";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("This reset link is missing a token. Request a new one.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || "Could not reset password");
        return;
      }
      setDone(true);
      window.setTimeout(() => router.push("/login"), 1600);
    } catch {
      setError("Could not reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="eyebrow">Account</div>
      <h1>Choose a new password</h1>
      <p className="muted">Pick a new password for your Vasritha account.</p>
      {!token ? (
        <p className="admin-alert admin-alert--error">
          This link is incomplete.{" "}
          <Link href="/forgot-password">Request a new reset email</Link>.
        </p>
      ) : done ? (
        <p className="admin-alert admin-alert--ok" role="status">
          Password updated. Taking you to sign in…
        </p>
      ) : (
        <form className="login-form" onSubmit={onSubmit}>
          <label>
            <span>New password</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <label>
            <span>Confirm password</span>
            <input
              type="password"
              name="confirm"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          {error ? <p className="admin-alert admin-alert--error">{error}</p> : null}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      )}
      <p className="login-footnote">
        <Link href="/login">Back to sign in</Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <Header />
      <main className="shell section login-page">
        <section className="login-card" data-reveal>
          <Suspense fallback={<p className="muted">Loading…</p>}>
            <ResetForm />
          </Suspense>
        </section>
      </main>
      <Footer />
    </>
  );
}
