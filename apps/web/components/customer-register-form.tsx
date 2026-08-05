"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { cacheAddressFromApi, getCustomerProfile, isLoggedIn } from "../lib/customer-session";
import { CUSTOMER_AUTH_EVENT } from "../lib/customer-auth-event";
import { mergeLocalCartToServer } from "../lib/cart";
import { storeFetch, storeRegister } from "../lib/store-api";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: ""
};

export function CustomerRegisterForm({ mode = "register" }: { mode?: "register" | "address" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/checkout";

  const seed = useMemo(() => {
    const profile = getCustomerProfile();
    return {
      name: profile?.name || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      password: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      pincode: ""
    };
  }, []);

  const [form, setForm] = useState({ ...emptyForm, ...seed });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onChange = (key: keyof typeof emptyForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "address" && !isLoggedIn()) {
      router.push(`/account/register?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    if (mode === "register") {
      const registered = await storeRegister({
        email: form.email.trim(),
        password: form.password,
        fullName: form.name.trim(),
        phone: form.phone.trim()
      });

      if (registered.error) {
        setLoading(false);
        setError(registered.error);
        return;
      }

      await mergeLocalCartToServer();
    }

    const addressResult = await storeFetch<{
      id: string;
      recipient_name: string;
      phone: string;
      line1: string;
      line2?: string | null;
      city: string;
      state: string;
      postal_code: string;
      is_default?: boolean;
    }>("/api/customer/addresses", {
      method: "POST",
      json: {
        recipient_name: form.name.trim() || getCustomerProfile()?.name || "Customer",
        phone: form.phone.trim() || getCustomerProfile()?.phone || "",
        line1: form.line1.trim(),
        line2: form.line2.trim() || null,
        city: form.city.trim(),
        state: form.state.trim(),
        postal_code: form.pincode.trim(),
        country: "India",
        is_default: true
      }
    });

    if (addressResult.error || !addressResult.data) {
      setLoading(false);
      setError(addressResult.error || "Could not save address");
      return;
    }

    cacheAddressFromApi(addressResult.data);
    window.dispatchEvent(new Event(CUSTOMER_AUTH_EVENT));
    setLoading(false);
    router.push(nextPath);
  };

  return (
    <form className="customer-form" onSubmit={onSubmit}>
      {mode === "register" && (
        <div className="customer-form-grid">
          <label>
            <span>Full name</span>
            <input value={form.name} onChange={onChange("name")} name="name" required autoComplete="name" />
          </label>
          <label>
            <span>Email</span>
            <input
              value={form.email}
              onChange={onChange("email")}
              type="email"
              name="email"
              required
              autoComplete="email"
            />
          </label>
          <label>
            <span>Phone</span>
            <input
              value={form.phone}
              onChange={onChange("phone")}
              type="tel"
              name="phone"
              required
              autoComplete="tel"
            />
          </label>
          <label>
            <span>Password</span>
            <input
              value={form.password}
              onChange={onChange("password")}
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
        </div>
      )}

      <div className="customer-form-block">
        <h3>{mode === "register" ? "Delivery address" : "Add new address"}</h3>
        <div className="customer-form-grid">
          {mode === "address" && (
            <>
              <label>
                <span>Full name</span>
                <input value={form.name} onChange={onChange("name")} name="name" required autoComplete="name" />
              </label>
              <label>
                <span>Phone</span>
                <input
                  value={form.phone}
                  onChange={onChange("phone")}
                  type="tel"
                  name="phone"
                  required
                  autoComplete="tel"
                />
              </label>
            </>
          )}
          <label className="customer-form-full">
            <span>Address line 1</span>
            <input
              value={form.line1}
              onChange={onChange("line1")}
              name="line1"
              required
              autoComplete="address-line1"
            />
          </label>
          <label className="customer-form-full">
            <span>Address line 2</span>
            <input
              value={form.line2}
              onChange={onChange("line2")}
              name="line2"
              autoComplete="address-line2"
            />
          </label>
          <label>
            <span>City</span>
            <input value={form.city} onChange={onChange("city")} name="city" required autoComplete="address-level2" />
          </label>
          <label>
            <span>State</span>
            <input
              value={form.state}
              onChange={onChange("state")}
              name="state"
              required
              autoComplete="address-level1"
            />
          </label>
          <label>
            <span>PIN code</span>
            <input
              value={form.pincode}
              onChange={onChange("pincode")}
              name="pincode"
              required
              autoComplete="postal-code"
            />
          </label>
        </div>
      </div>

      {error ? <p className="admin-alert admin-alert--error">{error}</p> : null}

      <button className="btn" type="submit" disabled={loading}>
        {loading
          ? "Saving…"
          : mode === "register"
            ? "Create account & continue"
            : "Save address & continue"}
      </button>

      {mode === "register" && (
        <p className="login-footnote">
          Already have an account? <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>Sign in</Link>
        </p>
      )}
    </form>
  );
}
