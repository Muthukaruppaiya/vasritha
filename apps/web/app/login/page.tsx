"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Footer, Header } from "../../components/storefront";
import {
  getCustomerProfile,
  getCustomerSession,
  getRawCustomerSession,
  saveCustomerSession
} from "../../lib/customer-session";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const existing = getCustomerProfile() ?? getCustomerSession();
  const [email, setEmail] = useState(existing?.email ?? "");
  const [name, setName] = useState(existing?.name ?? "");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const current = getRawCustomerSession();
    saveCustomerSession({
      name: name.trim() || current?.name || "Vasritha Guest",
      email: email.trim(),
      phone: current?.phone || "",
      address: {
        line1: current?.address?.line1 || "",
        line2: current?.address?.line2,
        city: current?.address?.city || "",
        state: current?.address?.state || "",
        pincode: current?.address?.pincode || ""
      }
    });
    router.push(nextPath);
  };

  return (
    <form className="login-form" onSubmit={onSubmit}>
      <label>
        <span>Name</span>
        <input
          type="text"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          autoComplete="name"
          required
        />
      </label>
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
      <label>
        <span>Password</span>
        <input type="password" name="password" placeholder="••••••••" autoComplete="current-password" required />
      </label>
      <button className="btn" type="submit">
        Sign in
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <>
      <Header />
      <main className="shell section login-page">
        <section className="login-card" data-reveal>
          <div className="eyebrow">Welcome back</div>
          <h1>Sign in to Vasritha</h1>
          <p className="muted">Access your orders, wishlist, and saved addresses.</p>
          <Suspense fallback={<p className="muted">Loading…</p>}>
            <LoginForm />
          </Suspense>
          <p className="login-footnote">
            New here? <Link href="/account/register">Create customer profile</Link>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
