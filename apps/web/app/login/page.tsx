"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Footer, Header } from "../../components/storefront";
import { mergeLocalCartToServer } from "../../lib/cart";
import { storeFetch, storeLogin } from "../../lib/store-api";
import { cacheAddressFromApi, isLoggedIn } from "../../lib/customer-session";
import { CUSTOMER_AUTH_EVENT } from "../../lib/customer-auth-event";
import { useT } from "../../lib/i18n/provider";

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/account";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const result = await storeLogin(email.trim(), password);
    if (result.error) {
      setLoading(false);
      setError(result.error);
      return;
    }

    await mergeLocalCartToServer();

    const addresses = await storeFetch<
      Array<{
        id: string;
        recipient_name: string;
        phone: string;
        line1: string;
        line2?: string | null;
        city: string;
        state: string;
        postal_code: string;
        is_default?: boolean;
      }>
    >("/api/customer/addresses");

    if (addresses.data?.length) {
      const preferred = addresses.data.find((row) => row.is_default) || addresses.data[0];
      cacheAddressFromApi(preferred);
    }

    window.dispatchEvent(new Event(CUSTOMER_AUTH_EVENT));
    setLoading(false);
    router.push(nextPath);
  };

  return (
    <form className="login-form" onSubmit={onSubmit}>
      <label>
        <span>{t("auth.email")}</span>
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
        <span>{t("auth.password")}</span>
        <input
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </label>
      {error ? <p className="admin-alert admin-alert--error">{error}</p> : null}
      <button className="btn" type="submit" disabled={loading}>
        {loading ? t("auth.signingIn") : t("auth.signIn")}
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
          <Suspense fallback={<p className="muted">Loading…</p>}>
            <LoginGate />
          </Suspense>
        </section>
      </main>
      <Footer />
    </>
  );
}

function LoginGate() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/account";
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace(nextPath);
      return;
    }
    setChecking(false);
  }, [nextPath, router]);

  if (checking) return <p className="muted">{t("common.loading")}</p>;

  return (
    <>
      <div className="eyebrow">{t("auth.welcomeBack")}</div>
      <h1>{t("auth.signIn")}</h1>
      <p className="muted">{t("auth.signInLead")}</p>
      <LoginForm />
      <p className="login-footnote">
        {t("auth.noAccount")}{" "}
        <Link href={`/account/register?next=${encodeURIComponent(nextPath)}`}>
          {t("auth.createOne")}
        </Link>
      </p>
    </>
  );
}
