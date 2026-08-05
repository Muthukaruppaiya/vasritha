"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  CreditCard,
  Minus,
  Plus,
  Printer,
  ScanBarcode,
  Search,
  Store,
  Trash2,
  X
} from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  statusTone
} from "../../../components/admin/admin-ui";
import { ThermalReceipt } from "../../../components/admin/thermal-receipt";
import { adminFetch, formatDate, formatMoney } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type PosItem = {
  productId: string;
  variantId: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  variantName: string | null;
  price: number;
  stock: number;
  imageSrc: string | null;
};

type CartLine = PosItem & { quantity: number; key: string };

type PosSale = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: string;
  discount_amount?: string;
  total_amount: string;
  channel?: string;
  created_at: string;
};

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

function lineKey(item: Pick<PosItem, "productId" | "variantId">) {
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

export default function AdminBillingPage() {
  const scanRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PosItem[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "razorpay">("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastInvoice, setLastInvoice] = useState<InvoiceOrder | null>(null);

  const { data, error: historyError, loading, reload } = useAdminQuery<PosSale[]>(
    "/api/admin/orders?channel=pos&paymentStatus=paid"
  );
  const storeSales = useMemo(() => (data || []).slice(0, 25), [data]);

  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const discountRaw = Math.max(0, Number(discountValue) || 0);
  const discountAmount =
    discountType === "percentage"
      ? Math.min(subtotal, (subtotal * discountRaw) / 100)
      : Math.min(subtotal, discountRaw);
  const payable = Math.max(0, subtotal - discountAmount);

  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setLookupError("");
      return;
    }

    const handle = window.setTimeout(() => {
      void (async () => {
        setLookingUp(true);
        setLookupError("");
        const result = await adminFetch<PosItem[]>(
          `/api/admin/pos/lookup?q=${encodeURIComponent(query.trim())}`
        );
        setLookingUp(false);
        if (result.error) {
          setLookupError(result.error);
          setSuggestions([]);
          return;
        }
        setSuggestions(result.data || []);
      })();
    }, 220);

    return () => window.clearTimeout(handle);
  }, [query]);

  const addItem = (item: PosItem) => {
    setCart((prev) => {
      const key = lineKey(item);
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
    setError("");
    setLastInvoice(null);
    scanRef.current?.focus();
  };

  const openInvoice = async (orderId: string) => {
    setError("");
    const result = await adminFetch<InvoiceOrder>(`/api/admin/orders/${orderId}`);
    if (result.error || !result.data) {
      setError(result.error || "Could not load invoice");
      return;
    }
    setLastInvoice(result.data);
  };

  const completeSale = async () => {
    if (!cart.length) {
      setError("Scan or search a product to start billing.");
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
          quantity: line.quantity
        })),
        discountType,
        discountValue: discountRaw,
        paymentMethod
      }
    });

    if (checkout.error || !checkout.data?.order) {
      setBusy(false);
      setError(checkout.error || "Checkout failed");
      return;
    }

    if (paymentMethod === "cash" || !checkout.data.razorpay) {
      setLastInvoice(checkout.data.order);
      setCart([]);
      setDiscountValue("0");
      setDiscountType("percentage");
      setPaymentMethod("cash");
      setBusy(false);
      await reload();
      scanRef.current?.focus();
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
      setLastInvoice({ ...checkout.data.order, payment_status: "paid", status: "confirmed" });
      setCart([]);
      setDiscountValue("0");
      setDiscountType("percentage");
      setPaymentMethod("cash");
      await reload();
      scanRef.current?.focus();
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
      name: "Vasritha Store POS",
      description: orderSnapshot.order_number,
      order_id: rzp.razorpayOrderId,
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
        setLastInvoice({ ...orderSnapshot, payment_status: "paid", status: "confirmed" });
        setCart([]);
        setDiscountValue("0");
        setDiscountType("percentage");
        setPaymentMethod("cash");
        await reload();
        scanRef.current?.focus();
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
    <>
      <AdminPageHeader
        title="Store POS"
        description="Physical store counter only — scan, discount, collect payment. Online orders live under Online Orders."
        actions={
          <button type="button" className="btn ghost" onClick={clearSale} disabled={busy}>
            New sale
          </button>
        }
      />

      <div className="pos-channel-banner">
        <Store size={16} />
        <span>In-store walk-in sales</span>
        <em>Online checkouts are handled on the Online Orders page.</em>
      </div>

      <div className="pos-layout">
        <section className="pos-counter">
          <AdminPanel
            title="Scan / search"
            actions={
              <span className="pos-hint muted">Barcode scanner ready · press Enter to add</span>
            }
          >
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

            {suggestions.length > 1 && (
              <div className="pos-suggest">
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
          </AdminPanel>

          <AdminPanel
            title="Cart"
            actions={
              cart.length ? (
                <AdminBadge tone="info">
                  {itemCount} item{itemCount === 1 ? "" : "s"}
                </AdminBadge>
              ) : null
            }
          >
            {!cart.length ? (
              <AdminEmpty
                title="Cart is empty"
                body="Scan a product barcode or search by name to add lines."
              />
            ) : (
              <div className="pos-cart">
                <div className="pos-cart-head">
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Total</span>
                  <span />
                </div>
                {cart.map((line) => (
                  <article key={line.key} className="pos-cart-line">
                    <div>
                      <strong>{line.name}</strong>
                      <p className="muted">
                        {line.sku || line.barcode || "—"}
                        {line.variantName ? ` · ${line.variantName}` : ""}
                      </p>
                      <p className="pos-unit">{formatMoney(line.price)} each</p>
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
                        disabled={line.quantity >= line.stock}
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
            )}
          </AdminPanel>
        </section>

        <aside className="pos-summary-panel">
          <AdminPanel title="Sale summary">
            <div className="pos-summary">
              <div className="pos-summary-row">
                <span>Subtotal</span>
                <strong>{formatMoney(subtotal)}</strong>
              </div>

              <div className="pos-discount">
                <div className="pos-discount-tabs">
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
                <label>
                  <span>Discount</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                  />
                </label>
              </div>

              <div className="pos-summary-row">
                <span>Discount</span>
                <strong>-{formatMoney(discountAmount)}</strong>
              </div>
              <div className="pos-summary-row pos-summary-total">
                <span>Payable</span>
                <strong>{formatMoney(payable)}</strong>
              </div>

              <div className="pos-pay-modes">
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
          </AdminPanel>
        </aside>
      </div>

      <AdminPanel title="Today’s store sales" className="pos-history-panel">
        {loading && <AdminLoading />}
        {historyError && <AdminAlert>{historyError}</AdminAlert>}
        {!loading && !historyError && !storeSales.length && (
          <AdminEmpty
            title="No store sales yet"
            body="Completed in-store POS payments appear here. Online orders stay on Online Orders."
          />
        )}
        {storeSales.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {storeSales.map((order) => (
                  <tr
                    key={order.id}
                    className={lastInvoice?.id === order.id ? "is-selected" : undefined}
                    onClick={() => void openInvoice(order.id)}
                  >
                    <td>
                      <b>INV-{order.order_number}</b>
                    </td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>
                      <AdminBadge tone={statusTone(order.payment_status)}>
                        {order.payment_status}
                      </AdminBadge>
                    </td>
                    <td>
                      <AdminBadge tone={statusTone(order.status)}>{order.status}</AdminBadge>
                    </td>
                    <td>{formatMoney(order.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      {lastInvoice && (
        <div className="pos-invoice-overlay" role="dialog" aria-modal="true">
          <div className="pos-invoice-sheet pos-invoice-sheet--thermal">
            <div className="tvs-receipt-preview-label">
              Preview · TVS LP 46 (108 mm thermal)
            </div>
            <ThermalReceipt data={lastInvoice} id="pos-invoice-print" />
            <div className="pos-invoice-actions">
              <button type="button" className="btn" onClick={() => window.print()}>
                <Printer size={14} />
                Print on TVS LP 46
              </button>
              <button type="button" className="btn ghost" onClick={() => setLastInvoice(null)}>
                <X size={14} />
                Close
              </button>
            </div>
            <p className="tvs-print-hint muted">
              In the print dialog, choose <b>TVS LP 46</b>, paper size ~108 mm / continuous, margins
              none or minimum, scale 100%.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
