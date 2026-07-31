"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  CustomerSession,
  getCustomerProfile,
  getCustomerSession,
  isLoggedIn,
  saveCustomerSession
} from "../lib/customer-session";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
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
    const full = getCustomerSession();
    const profile = getCustomerProfile();
    return {
      name: full?.name || profile?.name || "",
      email: full?.email || profile?.email || "",
      phone: full?.phone || profile?.phone || "",
      line1: full?.address.line1 || "",
      line2: full?.address.line2 || "",
      city: full?.address.city || "",
      state: full?.address.state || "",
      pincode: full?.address.pincode || ""
    };
  }, []);

  const [form, setForm] = useState({ ...emptyForm, ...seed });

  const onChange = (key: keyof typeof emptyForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (mode === "address" && !isLoggedIn()) {
      router.push(`/account/register?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    const profile = getCustomerProfile();
    const session: CustomerSession = {
      name: (form.name.trim() || profile?.name || "").trim(),
      email: (form.email.trim() || profile?.email || "").trim(),
      phone: (form.phone.trim() || profile?.phone || "").trim(),
      address: {
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim()
      }
    };

    if (!session.email) {
      router.push(`/account/register?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    saveCustomerSession(session);
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
        </div>
      )}

      <div className="customer-form-block">
        <h3>{mode === "register" ? "Delivery address" : "Add new address"}</h3>
        <div className="customer-form-grid">
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

      <button className="btn" type="submit">
        {mode === "register" ? "Create account & continue" : "Save address & continue"}
      </button>

      {mode === "register" && (
        <p className="login-footnote">
          Already have an account? <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>Sign in</Link>
        </p>
      )}
    </form>
  );
}
