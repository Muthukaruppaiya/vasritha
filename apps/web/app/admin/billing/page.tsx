"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Banknote,
  CreditCard,
  Minus,
  Plus,
  Printer,
  ScanBarcode,
  Search,
  Trash2,
  X
} from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty
} from "../../../components/admin/admin-ui";
import { InvoiceBill } from "../../../components/admin/invoice-bill";
import { adminFetch, formatMoney } from "../../../lib/admin-api";
import { OPS_PLATFORM_NAME } from "../../../lib/platform";
import Link from "next/link";

type PosItem = {
  productId: string;
  variantId: string | null;
  itemId?: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  variantName: string | null;
  price: number;
  stock: number;
  imageSrc: string | null;
};

type CartLine = PosItem & { quantity: number; key: string };

type ShopOption = {
  id: string;
  code: string;
  name: string;
  is_default: boolean;
};

const POS_SHOP_KEY = "vasritha_pos_shop_id";

type InvoiceOrder = {
  id: string;
  order_number: string;
  created_at: string;
  subtotal: string;
  discount_amount: string;
  total_amount: string;
  payment_status: string;
  status: string;
  channel: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  loyalty_points_earned?: number | null;
  loyalty_balance_after?: number | null;
  loyalty_prompt?: string | null;
  items: Array<{
    product_id: string;
    product_name: string;
    variant_name: string | null;
    sku: string | null;
    unit_price: number;
    quantity: number;
    line_total: number;
  }>;
};

type CheckoutResult = {
  order: InvoiceOrder;
  loyalty?: {
    points_earned?: number;
    balance_after?: number;
    prompt?: string | null;
  } | null;
  paymentMethod: "cash" | "razorpay";
  razorpay: {
    mode: string;
    paymentId: string;
    razorpayOrderId: string;
    keyId: string | null;
    amount: string;
    currency: string;
  } | null;
};

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

function lineKey(item: Pick<PosItem, "productId" | "variantId" | "itemId">) {
  if (item.itemId) return `item:${item.itemId}`;
  return `${item.productId}:${item.variantId || "base"}`;
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

type PosCustomerHit = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
};

export default function AdminBillingPage() {
  const scanRef = useRef<HTMLInputElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PosItem[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "razorpay">("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerHits, setCustomerHits] = useState<PosCustomerHit[]>([]);
  const [customerLookupBusy, setCustomerLookupBusy] = useState(false);
  const [customerStatus, setCustomerStatus] = useState<"idle" | "known" | "new">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastInvoice, setLastInvoice] = useState<InvoiceOrder | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [shopId, setShopId] = useState("");

  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const discountRaw = Math.max(0, Number(discountValue) || 0);
  const discountAmount =
    discountType === "percentage"
      ? Math.min(subtotal, (subtotal * discountRaw) / 100)
      : Math.min(subtotal, discountRaw);
  const payable = Math.max(0, subtotal - discountAmount);

  const normalizePhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
    return digits.slice(0, 10);
  };

  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  useEffect(() => {
    void (async () => {
      const result = await adminFetch<ShopOption[]>("/api/admin/shops?active=1");
      if (result.error || !result.data?.length) return;
      setShops(result.data);
      const saved =
        typeof window !== "undefined" ? window.localStorage.getItem(POS_SHOP_KEY) : null;
      const preferred =
        result.data.find((shop) => shop.id === saved) ||
        result.data.find((shop) => shop.is_default) ||
        result.data[0];
      if (preferred) setShopId(preferred.id);
    })();
  }, []);

  useEffect(() => {
    if (!shopId || typeof window === "undefined") return;
    window.localStorage.setItem(POS_SHOP_KEY, shopId);
  }, [shopId]);

  useEffect(() => {
    const phone = normalizePhone(customerPhone);
    if (phone.length < 3) {
      setCustomerHits([]);
      if (!phone.length) {
        setCustomerStatus("idle");
      }
      return;
    }

    const handle = window.setTimeout(() => {
      void (async () => {
        setCustomerLookupBusy(true);
        const result = await adminFetch<PosCustomerHit[]>(
          `/api/admin/pos/customers?q=${encodeURIComponent(phone)}`
        );
        setCustomerLookupBusy(false);
        if (result.error) {
          setCustomerHits([]);
          return;
        }
        const rows = result.data || [];
        setCustomerHits(rows);
        if (phone.length === 10) {
          const exact = rows.find((row) => row.phone === phone);
          if (exact) {
            setCustomerStatus("known");
            setCustomerName(exact.fullName || "");
            setCustomerEmail(exact.email || "");
            setCustomerHits([]);
            window.setTimeout(() => scanRef.current?.focus(), 0);
          } else if (!rows.length) {
            setCustomerStatus("new");
            window.setTimeout(() => nameRef.current?.focus(), 0);
          } else {
            setCustomerStatus("idle");
          }
        } else {
          setCustomerStatus("idle");
        }
      })();
    }, 200);

    return () => window.clearTimeout(handle);
  }, [customerPhone]);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setSuggestions([]);
      setLookupError("");
      return;
    }

    const handle = window.setTimeout(() => {
      void (async () => {
        setLookingUp(true);
        setLookupError("");
        const result = await adminFetch<PosItem[]>(
          `/api/admin/pos/lookup?q=${encodeURIComponent(term)}`
        );
        setLookingUp(false);
        if (result.error) {
          setLookupError(result.error);
          setSuggestions([]);
          return;
        }
        setSuggestions(result.data || []);
      })();
    }, 180);

    return () => window.clearTimeout(handle);
  }, [query]);

  const pickCustomer = (hit: PosCustomerHit) => {
    setCustomerPhone(hit.phone);
    setCustomerName(hit.fullName || "");
    setCustomerEmail(hit.email || "");
    setCustomerHits([]);
    setCustomerStatus("known");
    window.setTimeout(() => scanRef.current?.focus(), 0);
  };

  const addItem = (item: PosItem) => {
    const key = lineKey(item);
    setCart((prev) => {
      const existing = prev.find((line) => line.key === key);
      if (existing) {
        if (existing.quantity >= item.stock) return prev;
        return prev.map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + 1, stock: item.stock } : line
        );
      }
      if (item.stock <= 0) return prev;
      return [...prev, { ...item, quantity: 1, key }];
    });
    setFlashKey(key);
    window.setTimeout(() => {
      setFlashKey((current) => (current === key ? null : current));
    }, 520);
    setQuery("");
    setSuggestions([]);
    setLookupError("");
    window.setTimeout(() => scanRef.current?.focus(), 0);
  };

  const onScanSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;

    setLookingUp(true);
    setLookupError("");
    const result = await adminFetch<PosItem[]>(
      `/api/admin/pos/lookup?q=${encodeURIComponent(term)}`
    );
    setLookingUp(false);

    if (result.error) {
      setLookupError(result.error);
      return;
    }

    const rows = result.data || [];
    if (!rows.length) {
      setLookupError("No product found for that code or search.");
      setSuggestions([]);
      return;
    }

    const exact = rows.find(
      (row) =>
        row.barcode?.toUpperCase() === term.toUpperCase() ||
        row.sku?.toUpperCase() === term.toUpperCase()
    );
    if (exact || rows.length === 1) {
      addItem(exact || rows[0]);
      return;
    }

    setSuggestions(rows);
  };

  const setQty = (key: string, quantity: number) => {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.key !== key) return line;
          const next = Math.max(0, Math.min(line.stock, Math.floor(quantity)));
          return { ...line, quantity: next };
        })
        .filter((line) => line.quantity > 0)
    );
  };

  const clearSale = () => {
    setCart([]);
    setDiscountValue("0");
    setDiscountType("percentage");
    setPaymentMethod("cash");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCustomerHits([]);
    setCustomerStatus("idle");
    setError("");
    setLastInvoice(null);
    window.setTimeout(() => phoneRef.current?.focus(), 0);
  };

  const resetAfterPaid = () => {
    setCart([]);
    setDiscountValue("0");
    setDiscountType("percentage");
    setPaymentMethod("cash");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCustomerHits([]);
    setCustomerStatus("idle");
  };

  const completeSale = async () => {
    if (!cart.length) {
      setError("Scan or search a product to start billing.");
      return;
    }

    const name = customerName.trim();
    const phone = normalizePhone(customerPhone);
    const email = customerEmail.trim();

    if (phone.length !== 10) {
      setError("Enter a valid 10-digit mobile number first.");
      phoneRef.current?.focus();
      return;
    }
    if (!name) {
      setError(
        customerStatus === "new"
          ? "New customer — enter their name."
          : "Customer name is required."
      );
      nameRef.current?.focus();
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setBusy(true);
    setError("");

    const checkout = await adminFetch<CheckoutResult>("/api/admin/pos/checkout", {
      method: "POST",
      json: {
        items: cart.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          itemId: line.itemId || null,
          quantity: line.itemId ? 1 : line.quantity
        })),
        discountType,
        discountValue: discountRaw,
        paymentMethod,
        customerName: name,
        customerPhone: phone,
        customerEmail: email || null,
        shopId: shopId || null
      }
    });

    if (checkout.error || !checkout.data?.order) {
      setBusy(false);
      setError(checkout.error || "Checkout failed");
      return;
    }

    if (paymentMethod === "cash" || !checkout.data.razorpay) {
      setLastInvoice({
        ...checkout.data.order,
        loyalty_points_earned:
          checkout.data.loyalty?.points_earned ?? checkout.data.order.loyalty_points_earned,
        loyalty_balance_after:
          checkout.data.loyalty?.balance_after ?? checkout.data.order.loyalty_balance_after,
        loyalty_prompt: checkout.data.loyalty?.prompt ?? checkout.data.order.loyalty_prompt
      });
      resetAfterPaid();
      setBusy(false);
      window.setTimeout(() => phoneRef.current?.focus(), 0);
      return;
    }

    const rzp = checkout.data.razorpay;

    if (rzp.mode === "test" || !rzp.keyId) {
      const verified = await adminFetch("/api/admin/pos/verify", {
        method: "POST",
        json: {
          orderId: checkout.data.order.id,
          paymentId: rzp.paymentId,
          razorpayOrderId: rzp.razorpayOrderId,
          testSuccess: true
        }
      });
      setBusy(false);
      if (verified.error) {
        setError(verified.error);
        return;
      }
      setLastInvoice({
        ...checkout.data.order,
        payment_status: "paid",
        status: "confirmed",
        loyalty_points_earned:
          (verified.data as { loyalty?: { points_earned?: number } } | undefined)?.loyalty
            ?.points_earned ?? checkout.data.order.loyalty_points_earned,
        loyalty_balance_after:
          (verified.data as { loyalty?: { balance_after?: number } } | undefined)?.loyalty
            ?.balance_after ?? checkout.data.order.loyalty_balance_after,
        loyalty_prompt:
          (verified.data as { loyalty?: { prompt?: string | null } } | undefined)?.loyalty
            ?.prompt ?? checkout.data.order.loyalty_prompt
      });
      resetAfterPaid();
      window.setTimeout(() => phoneRef.current?.focus(), 0);
      return;
    }

    const ready = await loadRazorpayScript();
    if (!ready || !window.Razorpay) {
      setBusy(false);
      setError("Could not load Razorpay Checkout");
      return;
    }

    const orderSnapshot = checkout.data.order;
    const razorpay = new window.Razorpay({
      key: rzp.keyId,
      amount: Math.round(Number(rzp.amount) * 100),
      currency: rzp.currency,
      name: `${OPS_PLATFORM_NAME} Store POS`,
      description: orderSnapshot.order_number,
      order_id: rzp.razorpayOrderId,
      prefill: {
        name,
        contact: phone,
        email: email || undefined
      },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        const verified = await adminFetch("/api/admin/pos/verify", {
          method: "POST",
          json: {
            orderId: orderSnapshot.id,
            paymentId: rzp.paymentId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature
          }
        });
        setBusy(false);
        if (verified.error) {
          setError(verified.error);
          return;
        }
        setLastInvoice({
          ...orderSnapshot,
          payment_status: "paid",
          status: "confirmed",
          loyalty_points_earned:
            (verified.data as { loyalty?: { points_earned?: number } } | undefined)?.loyalty
              ?.points_earned ?? orderSnapshot.loyalty_points_earned,
          loyalty_balance_after:
            (verified.data as { loyalty?: { balance_after?: number } } | undefined)?.loyalty
              ?.balance_after ?? orderSnapshot.loyalty_balance_after,
          loyalty_prompt:
            (verified.data as { loyalty?: { prompt?: string | null } } | undefined)?.loyalty
              ?.prompt ?? orderSnapshot.loyalty_prompt
        });
        resetAfterPaid();
        window.setTimeout(() => phoneRef.current?.focus(), 0);
      },
      modal: {
        ondismiss: () => {
          setBusy(false);
          setError("Payment cancelled. Order left pending — retry Razorpay or use Cash.");
        }
      }
    });
    razorpay.open();
  };

  return (
    <div className="pos-screen">
      <header className="pos-screen-head">
        <div>
          <p className="eyebrow">{OPS_PLATFORM_NAME} · POS</p>
          <h1>Store POS</h1>
        </div>
        <div className="pos-screen-actions">
          {shops.length > 0 ? (
            <label className="pos-shop-select">
              <span>Shop</span>
              <select
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                disabled={busy || !shops.length}
              >
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name}
                    {shop.is_default ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Link href="/admin/invoices/store" className="pos-invoice-mini">
            Past invoices
          </Link>
          <button type="button" className="btn admin-ghost-btn" onClick={clearSale} disabled={busy}>
            <Plus size={15} />
            New sale
          </button>
        </div>
      </header>

      <div className="pos-layout">
        <section className="pos-counter">
          <div className="pos-workspace admin-panel">
            <div className="pos-workspace-scan">
              <form className="pos-scan" onSubmit={onScanSubmit}>
                <label className="pos-scan-field">
                  <ScanBarcode size={18} />
                  <input
                    ref={scanRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Scan barcode or search name / SKU"
                    autoComplete="off"
                    disabled={busy}
                  />
                </label>
                <button className="btn" type="submit" disabled={busy || lookingUp}>
                  <Search size={14} />
                  {lookingUp ? "…" : "Add"}
                </button>
              </form>
              {lookupError ? <AdminAlert>{lookupError}</AdminAlert> : null}
              {suggestions.length > 0 && (
                <div className="pos-suggest" role="listbox" aria-label="Product suggestions">
                  {suggestions.map((item) => (
                    <button
                      key={lineKey(item)}
                      type="button"
                      className="pos-suggest-row"
                      onClick={() => addItem(item)}
                    >
                      <span>
                        <strong>{item.name}</strong>
                        <em>
                          {item.sku || item.barcode || "—"}
                          {item.variantName ? ` · ${item.variantName}` : ""}
                        </em>
                      </span>
                      <span>
                        {formatMoney(item.price)}
                        <small>Stock {item.stock}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {query.trim() && !lookingUp && !suggestions.length && !lookupError ? (
                <p className="pos-suggest-empty muted">No matching product for “{query.trim()}”.</p>
              ) : null}
            </div>

            <div className="pos-workspace-cart">
              <div className="pos-workspace-cart-head">
                <strong>Cart</strong>
                {cart.length ? (
                  <AdminBadge tone="info">
                    {itemCount} item{itemCount === 1 ? "" : "s"}
                  </AdminBadge>
                ) : null}
              </div>
              {!cart.length ? (
                <AdminEmpty
                  title="Cart is empty"
                  body="Scan a barcode or search to add items."
                />
              ) : (
                <div className="pos-cart">
                  <div className="pos-cart-head">
                    <span>Item</span>
                    <span>Qty</span>
                    <span>Total</span>
                    <span />
                  </div>
                  <div className="pos-cart-body">
                    {cart.map((line) => (
                      <article
                        key={line.key}
                        className={`pos-cart-line${flashKey === line.key ? " is-flash" : ""}`}
                      >
                        <div className="pos-cart-item">
                          <div className="pos-cart-thumb" aria-hidden="true">
                            {line.imageSrc ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={line.imageSrc} alt="" />
                            ) : (
                              <ScanBarcode size={16} />
                            )}
                          </div>
                          <div>
                            <strong>{line.name}</strong>
                            <p className="muted">
                              {line.sku || line.barcode || "—"}
                              {line.variantName ? ` · ${line.variantName}` : ""}
                            </p>
                            <p className="pos-unit">{formatMoney(line.price)} each</p>
                          </div>
                        </div>
                        <div className="pos-qty">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => setQty(line.key, line.quantity - 1)}
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={line.stock}
                            value={line.quantity}
                            onChange={(e) => setQty(line.key, Number(e.target.value))}
                          />
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => setQty(line.key, line.quantity + 1)}
                            disabled={Boolean(line.itemId) || line.quantity >= line.stock}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <strong className="pos-line-total">
                          {formatMoney(line.price * line.quantity)}
                        </strong>
                        <button
                          type="button"
                          className="pos-remove"
                          aria-label="Remove line"
                          onClick={() => setQty(line.key, 0)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="pos-summary-panel">
          <div className="pos-summary admin-panel">
            <div className="admin-panel-head">
              <h3>Sale summary</h3>
            </div>

            <section className="pos-customer" aria-label="Customer details">
              <div className="pos-customer-head">
                <p className="pos-customer-title">Customer</p>
                <span className="pos-customer-req">
                  {customerStatus === "known"
                    ? "Existing customer"
                    : customerStatus === "new"
                      ? "New customer — enter name"
                      : "Mobile first, then name"}
                </span>
              </div>
              <div className="pos-customer-fields">
                <label className="pos-field pos-field--phone">
                  <span className="pos-field-label">
                    Mobile <em aria-hidden="true">*</em>
                  </span>
                  <input
                    ref={phoneRef}
                    type="tel"
                    inputMode="numeric"
                    value={customerPhone}
                    onChange={(e) => {
                      const next = normalizePhone(e.target.value);
                      setCustomerPhone(next);
                      if (customerStatus === "known") {
                        setCustomerName("");
                        setCustomerEmail("");
                        setCustomerStatus("idle");
                      }
                    }}
                    placeholder="10-digit mobile"
                    autoComplete="tel"
                    maxLength={10}
                    disabled={busy}
                    required
                  />
                  {customerLookupBusy ? (
                    <span className="pos-field-hint muted">Searching…</span>
                  ) : null}
                  {customerHits.length > 0 ? (
                    <div className="pos-customer-suggest" role="listbox" aria-label="Matching customers">
                      {customerHits.map((hit) => (
                        <button
                          key={hit.id}
                          type="button"
                          className="pos-customer-suggest-row"
                          onClick={() => pickCustomer(hit)}
                        >
                          <strong>{hit.phone}</strong>
                          <span>{hit.fullName || "Customer"}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </label>
                <label className="pos-field">
                  <span className="pos-field-label">
                    Name <em aria-hidden="true">*</em>
                  </span>
                  <input
                    ref={nameRef}
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={
                      customerStatus === "new" ? "Enter new customer name" : "Full name"
                    }
                    autoComplete="name"
                    disabled={busy || normalizePhone(customerPhone).length < 10}
                    required
                  />
                </label>
                <label className="pos-field">
                  <span className="pos-field-label">
                    Email <span className="pos-field-optional">optional</span>
                  </span>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    disabled={busy || normalizePhone(customerPhone).length < 10}
                  />
                </label>
              </div>
            </section>

            <div className="pos-totals-block">
              <div className="pos-summary-row">
                <span>Subtotal</span>
                <strong>{formatMoney(subtotal)}</strong>
              </div>

              <div className="pos-discount">
                <div className="pos-discount-tabs" role="group" aria-label="Discount type">
                  <button
                    type="button"
                    className={discountType === "percentage" ? "is-active" : ""}
                    onClick={() => setDiscountType("percentage")}
                  >
                    % Off
                  </button>
                  <button
                    type="button"
                    className={discountType === "fixed" ? "is-active" : ""}
                    onClick={() => setDiscountType("fixed")}
                  >
                    ₹ Off
                  </button>
                </div>
                <label className="pos-field pos-field--compact">
                  <span className="pos-field-label">Discount</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    disabled={busy}
                  />
                </label>
              </div>

              <div className="pos-summary-row">
                <span>Discount</span>
                <strong className="pos-discount-value">-{formatMoney(discountAmount)}</strong>
              </div>
              <div className="pos-summary-row pos-summary-total">
                <span>Payable</span>
                <strong>{formatMoney(payable)}</strong>
              </div>
            </div>

            <div className="pos-pay-modes" role="group" aria-label="Payment method">
              <button
                type="button"
                className={paymentMethod === "cash" ? "is-active" : ""}
                onClick={() => setPaymentMethod("cash")}
              >
                <Banknote size={16} />
                Cash
              </button>
              <button
                type="button"
                className={paymentMethod === "razorpay" ? "is-active" : ""}
                onClick={() => setPaymentMethod("razorpay")}
              >
                <CreditCard size={16} />
                Razorpay
              </button>
            </div>

            {error ? <AdminAlert>{error}</AdminAlert> : null}

            <button
              type="button"
              className="btn pos-pay-btn"
              disabled={busy || !cart.length}
              onClick={() => void completeSale()}
            >
              {busy
                ? "Processing…"
                : paymentMethod === "cash"
                  ? `Collect ${formatMoney(payable)}`
                  : `Pay ${formatMoney(payable)} with Razorpay`}
            </button>
          </div>
        </aside>
      </div>

      {lastInvoice && (
        <div className="pos-invoice-overlay" role="dialog" aria-modal="true">
          <div className="pos-invoice-sheet pos-invoice-sheet--a4">
            {lastInvoice.loyalty_prompt ? (
              <AdminAlert tone="ok">
                Tell the customer: {lastInvoice.loyalty_prompt}
              </AdminAlert>
            ) : null}
            <div className="tvs-receipt-preview-label">Shop bill · 3″ (80mm) thermal · auto-cut</div>
            <InvoiceBill data={lastInvoice} id="pos-invoice-print" />
            <div className="pos-invoice-actions">
              <button type="button" className="btn" onClick={() => window.print()}>
                <Printer size={14} />
                Print bill
              </button>
              <button type="button" className="btn ghost" onClick={() => setLastInvoice(null)}>
                <X size={14} />
                Close
              </button>
            </div>
            <p className="tvs-print-hint muted">
              Paper width <b>3 inch / 80 mm</b> thermal · height follows bill length (auto-cut).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
