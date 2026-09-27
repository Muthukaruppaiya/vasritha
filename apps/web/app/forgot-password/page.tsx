"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Footer, Header } from "../../components/storefront";

function ForgotForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/account";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setDone(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || "Could not send reset email");
        return;
      }
      setDone(payload?.data?.message || "Check your email for a reset link.");
    } catch {
      setError("Could not send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="eyebrow">Account</div>
      <h1>Forgot password</h1>
      <p className="muted">
        Enter the email on your account. We&apos;ll send a link to choose a new password.
      </p>
      {done ? (
        <p className="admin-alert admin-alert--ok" role="status">
          {done}
        </p>
      ) : (
        <form className="login-form" onSubmit={onSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          {error ? <p className="admin-alert admin-alert--error">{error}</p> : null}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="login-footnote">
        <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>Back to sign in</Link>
      </p>
    </>
  );
}

export default function ForgotPasswordPage() {
  return (
    <>
      <Header />
      <main className="shell section login-page">
        <section className="login-card" data-reveal>
          <Suspense fallback={<p className="muted">Loading…</p>}>
            <ForgotForm />
          </Suspense>
        </section>
      </main>
      <Footer />
    </>
  );
}
