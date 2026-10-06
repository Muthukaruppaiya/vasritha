"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  HandCoins,
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
import { adminFetch, formatDate, formatMoney, getAdminUser } from "../../../lib/admin-api";
import { isValidEmail, isValidPhone10, normalizePhone10 } from "../../../lib/validation";
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
  cashier_name?: string | null;
  cashier_id?: string | null;
  loyalty_points_earned?: number | null;
  loyalty_balance_after?: number | null;
  loyalty_prompt?: string | null;
  amount_paid?: number | string | null;
  balance_due?: number | string | null;
  seller?: {
    legal_name?: string | null;
    address?: string | null;
    gstin?: string | null;
    state?: string | null;
    state_code?: string | null;
    phone?: string | null;
    email?: string | null;
    shop_name?: string | null;
    shop_code?: string | null;
  } | null;
  gst?: {
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    inclusive?: boolean;
  } | null;
  items: Array<{
    id?: string;
    product_id: string;
    variant_id?: string | null;
    product_name: string;
    variant_name: string | null;
    sku: string | null;
    hsn_code?: string | null;
    gst_rate?: number | string | null;
    unit_price: number;
    quantity: number;
    line_total: number;
    returned_qty?: number;
    remaining_qty?: number;
  }>;
};

type PosInvoiceHit = {
  id: string;
  order_number: string;
  created_at: string;
  total_amount: string;
  customer_name: string | null;
  customer_phone: string | null;
  line_count: number;
};

type ExchangeReturnLine = {
  orderItemId: string;
  productName: string;
  variantName: string | null;
  sku: string | null;
  unitPrice: number;
  maxQty: number;
  quantity: number;
};

type ExchangeContext = {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  lines: ExchangeReturnLine[];
};

type CheckoutResult = {
  order: InvoiceOrder;
  loyalty?: {
    points_earned?: number;
    balance_after?: number;
    prompt?: string | null;
  } | null;
  paymentMethod: "cash" | "razorpay" | "credit";
  amountPaid?: number;
  balanceDue?: number;
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
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "razorpay" | "credit">("cash");
  const [creditPaidNow, setCreditPaidNow] = useState("");
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
  const [shopLocked, setShopLocked] = useState(false);
  const [exchange, setExchange] = useState<ExchangeContext | null>(null);
  const [exchangeBrowseOpen, setExchangeBrowseOpen] = useState(false);
  const [exchangeQuery, setExchangeQuery] = useState("");
  const [exchangeHits, setExchangeHits] = useState<PosInvoiceHit[]>([]);
  const [exchangeBusy, setExchangeBusy] = useState(false);
  const [exchangePickOpen, setExchangePickOpen] = useState(false);
  const [exchangeDraftLines, setExchangeDraftLines] = useState<ExchangeReturnLine[]>([]);
  const [exchangeDraftMeta, setExchangeDraftMeta] = useState<{
    orderId: string;
    orderNumber: string;
    customerName: string | null;
    customerPhone: string | null;
  } | null>(null);

  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const discountRaw = Math.max(0, Number(discountValue) || 0);
  const discountAmount =
    discountType === "percentage"
      ? Math.min(subtotal, (subtotal * discountRaw) / 100)
      : Math.min(subtotal, discountRaw);
  const returnCredit =
    exchange?.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) || 0;
  const payable = Math.max(0, subtotal - discountAmount - returnCredit);
  const creditPaidRaw = Math.max(0, Number(creditPaidNow) || 0);
  const creditPaidClamped =
    paymentMethod === "credit" ? Math.min(payable, creditPaidRaw) : payable;
  const creditBalanceDue =
    paymentMethod === "credit" ? Math.max(0, payable - creditPaidClamped) : 0;

  const normalizePhone = (value: string) => normalizePhone10(value);

  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  useEffect(() => {
    void (async () => {
      const result = await adminFetch<ShopOption[]>("/api/admin/shops?active=1");
      if (result.error || !result.data?.length) return;
      const bound = getAdminUser()?.shopId || null;
      setShopLocked(Boolean(bound));
      const list = bound
        ? result.data.filter((shop) => shop.id === bound)
        : result.data;
      setShops(list.length ? list : result.data);
      if (bound) {
        setShopId(bound);
        return;
      }
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
    if (!shopId || typeof window === "undefined" || shopLocked) return;
    window.localStorage.setItem(POS_SHOP_KEY, shopId);
  }, [shopId, shopLocked]);

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
        const shopQs = shopId ? `&shopId=${encodeURIComponent(shopId)}` : "";
        const result = await adminFetch<PosItem[]>(
          `/api/admin/pos/lookup?q=${encodeURIComponent(term)}${shopQs}`
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
  }, [query, shopId]);

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
    const shopQs = shopId ? `&shopId=${encodeURIComponent(shopId)}` : "";
    const result = await adminFetch<PosItem[]>(
      `/api/admin/pos/lookup?q=${encodeURIComponent(term)}${shopQs}`
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
    setCreditPaidNow("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCustomerHits([]);
    setCustomerStatus("idle");
    setError("");
    setLastInvoice(null);
    setExchange(null);
    setExchangeBrowseOpen(false);
    setExchangePickOpen(false);
    setExchangeDraftLines([]);
    setExchangeDraftMeta(null);
    window.setTimeout(() => phoneRef.current?.focus(), 0);
  };

  const resetAfterPaid = () => {
    setCart([]);
    setDiscountValue("0");
    setDiscountType("percentage");
    setPaymentMethod("cash");
    setCreditPaidNow("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCustomerHits([]);
    setCustomerStatus("idle");
    setExchange(null);
    setExchangeBrowseOpen(false);
    setExchangePickOpen(false);
    setExchangeDraftLines([]);
    setExchangeDraftMeta(null);
  };

  const clearExchange = () => {
    setExchange(null);
    setExchangePickOpen(false);
    setExchangeDraftLines([]);
    setExchangeDraftMeta(null);
  };

  const normalizeInvoiceCode = (value: string) => {
    let q = value.trim();
    q = q.replace(/^INV[-\s]*/i, "");
    q = q.replace(/\s+/g, "");
    return q;
  };

  const searchExchangeInvoices = async (q: string, opts?: { autoOpen?: boolean }) => {
    setExchangeBusy(true);
    setError("");
    const params = new URLSearchParams();
    const cleaned = normalizeInvoiceCode(q);
    if (cleaned) params.set("q", cleaned);
    else if (q.trim()) params.set("q", q.trim());
    if (shopId) params.set("shopId", shopId);
    const result = await adminFetch<PosInvoiceHit[]>(
      `/api/admin/pos/invoices?${params.toString()}`
    );
    setExchangeBusy(false);
    if (result.error) {
      setError(result.error);
      setExchangeHits([]);
      return;
    }
    const hits = result.data || [];
    setExchangeHits(hits);
    // Scanner / exact bill no. → open the invoice immediately when unique.
    if (opts?.autoOpen && hits.length === 1) {
      void loadInvoiceForExchange(hits[0].id);
    }
  };

  const applyExchangeSelection = (
    meta: {
      orderId: string;
      orderNumber: string;
      customerName: string | null;
      customerPhone: string | null;
    },
    lines: ExchangeReturnLine[]
  ) => {
    const selected = lines.filter((l) => l.quantity > 0);
    if (!selected.length) {
      setError("Select at least one item to return / exchange.");
      return;
    }
    setExchange({ ...meta, lines: selected });
    if (meta.customerPhone) {
      setCustomerPhone(normalizePhone(meta.customerPhone));
      setCustomerStatus("known");
    }
    if (meta.customerName) setCustomerName(meta.customerName);
    setExchangeBrowseOpen(false);
    setExchangePickOpen(false);
    setExchangeDraftLines([]);
    setExchangeDraftMeta(null);
    setError("");
    window.setTimeout(() => scanRef.current?.focus(), 0);
  };

  const loadInvoiceForExchange = async (invoiceId: string) => {
    setExchangeBusy(true);
    setError("");
    const result = await adminFetch<InvoiceOrder>(`/api/admin/orders/${invoiceId}`);
    setExchangeBusy(false);
    if (result.error || !result.data) {
      setError(result.error || "Could not load invoice");
      return;
    }
    const order = result.data;
    const lines: ExchangeReturnLine[] = (order.items || [])
      .map((item) => {
        const remaining =
          item.remaining_qty != null
            ? Number(item.remaining_qty)
            : Math.max(0, Number(item.quantity) - Number(item.returned_qty || 0));
        if (!item.id || remaining <= 0) return null;
        return {
          orderItemId: item.id,
          productName: item.product_name,
          variantName: item.variant_name,
          sku: item.sku,
          unitPrice: Number(item.unit_price),
          maxQty: remaining,
          quantity: remaining
        } as ExchangeReturnLine;
      })
      .filter(Boolean) as ExchangeReturnLine[];

    if (!lines.length) {
      setError("No exchangeable items left on this invoice.");
      return;
    }

    const meta = {
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name || null,
      customerPhone: order.customer_phone || null
    };

    if (lines.length === 1) {
      applyExchangeSelection(meta, lines);
      return;
    }

    setExchangeDraftMeta(meta);
    setExchangeDraftLines(lines);
    setExchangePickOpen(true);
  };

  const completeSale = async () => {
    if (!cart.length) {
      setError("Scan or search a product to start billing.");
      return;
    }

    const name = customerName.trim();
    const phone = normalizePhone(customerPhone);
    const email = customerEmail.trim();

    if (!isValidPhone10(phone, { required: true })) {
      setError("Enter a valid 10-digit mobile number (starts with 6–9).");
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
    if (email && !isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (exchange && !exchange.lines.length) {
      setError("Select return items for this exchange.");
      return;
    }

    if (paymentMethod === "credit") {
      if (!Number.isFinite(Number(creditPaidNow)) || Number(creditPaidNow) < 0) {
        setError("Enter how much the customer is paying now (0 allowed).");
        return;
      }
      if (creditPaidClamped >= payable && payable > 0) {
        setError("For full payment use Cash. Credit is for balance left to pay later.");
        return;
      }
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
        amountPaid: paymentMethod === "credit" ? creditPaidClamped : undefined,
        customerName: name,
        customerPhone: phone,
        customerEmail: email || null,
        shopId: shopId || null,
        exchange: exchange
          ? {
              orderId: exchange.orderId,
              items: exchange.lines.map((line) => ({
                orderItemId: line.orderItemId,
                quantity: line.quantity
              }))
            }
          : undefined
      }
    });

    if (checkout.error || !checkout.data?.order) {
      setBusy(false);
      setError(checkout.error || "Checkout failed");
      return;
    }

    if (paymentMethod === "cash" || paymentMethod === "credit" || !checkout.data.razorpay) {
      setLastInvoice({
        ...checkout.data.order,
        amount_paid:
          checkout.data.amountPaid ??
          checkout.data.order.amount_paid ??
          (paymentMethod === "credit" ? creditPaidClamped : payable),
        balance_due:
          checkout.data.balanceDue ??
          checkout.data.order.balance_due ??
          (paymentMethod === "credit" ? creditBalanceDue : 0),
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
              <span>{shopLocked ? "Your store" : "Shop"}</span>
              <select
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                disabled={busy || !shops.length || shopLocked}
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
          <Link href="/admin/billing/dues" className="pos-invoice-mini">
            Credit dues
          </Link>
          <button
            type="button"
            className="btn admin-ghost-btn"
            disabled={busy}
            onClick={() => {
              setExchangeBrowseOpen(true);
              setExchangeQuery("");
              void searchExchangeInvoices("");
            }}
          >
            <ArrowLeftRight size={15} />
            Exchange
          </button>
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
                      <span className="pos-suggest-thumb" aria-hidden="true">
                        {item.imageSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageSrc} alt="" />
                        ) : (
                          <ScanBarcode size={16} />
                        )}
                      </span>
                      <span className="pos-suggest-copy">
                        <strong>{item.name}</strong>
                        <em>
                          {item.sku || item.barcode || "—"}
                          {item.variantName ? ` · ${item.variantName}` : ""}
                        </em>
                      </span>
                      <span className="pos-suggest-meta">
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
                  title={exchange ? "Add the new exchange item" : "Cart is empty"}
                  body={
                    exchange
                      ? "Return is selected. Scan or search the replacement product on the left, then complete the exchange."
                      : "Scan a barcode or search to add items."
                  }
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

            {exchange ? (
              <div className="pos-exchange-banner">
                <div>
                  <strong>Exchange · {exchange.orderNumber}</strong>
                  <p className="muted">
                    Returning {exchange.lines.length} line
                    {exchange.lines.length === 1 ? "" : "s"} · credit{" "}
                    {formatMoney(returnCredit)}
                  </p>
                  <ul className="pos-exchange-lines">
                    {exchange.lines.map((line) => (
                      <li key={line.orderItemId}>
                        {line.productName}
                        {line.variantName ? ` · ${line.variantName}` : ""} × {line.quantity} —{" "}
                        {formatMoney(line.unitPrice * line.quantity)}
                      </li>
                    ))}
                  </ul>
                </div>
                <button type="button" className="btn admin-ghost-btn" onClick={clearExchange}>
                  Clear
                </button>
              </div>
            ) : null}

            <div className="pos-totals-block">
              <div className="pos-summary-row">
                <span>New items</span>
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
              {returnCredit > 0 ? (
                <div className="pos-summary-row">
                  <span>Return credit</span>
                  <strong className="pos-discount-value">-{formatMoney(returnCredit)}</strong>
                </div>
              ) : null}
              <div className="pos-summary-row pos-summary-total">
                <span>{exchange ? "Collect from customer" : "Payable"}</span>
                <strong>{formatMoney(payable)}</strong>
              </div>
              {paymentMethod === "credit" ? (
                <>
                  <div className="pos-summary-row">
                    <span>Paying now</span>
                    <strong>{formatMoney(creditPaidClamped)}</strong>
                  </div>
                  <div className="pos-summary-row">
                    <span>Balance due later</span>
                    <strong className="pos-discount-value">{formatMoney(creditBalanceDue)}</strong>
                  </div>
                </>
              ) : null}
              {exchange && returnCredit > subtotal - discountAmount ? (
                <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.8rem" }}>
                  Return value exceeds new items — no cash refund (exchange only). Collect ₹0.
                </p>
              ) : null}
            </div>

            <div className="pos-pay-modes pos-pay-modes--3" role="group" aria-label="Payment method">
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
                className={paymentMethod === "credit" ? "is-active" : ""}
                onClick={() => {
                  setPaymentMethod("credit");
                  if (!creditPaidNow) {
                    setCreditPaidNow(
                      payable > 0 ? String(Math.round((payable / 2) * 100) / 100) : "0"
                    );
                  }
                }}
              >
                <HandCoins size={16} />
                Credit
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

            {paymentMethod === "credit" ? (
              <label className="pos-field pos-field--compact">
                <span className="pos-field-label">Amount received now</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  max={payable}
                  value={creditPaidNow}
                  onChange={(e) => setCreditPaidNow(e.target.value)}
                  disabled={busy}
                  placeholder="e.g. half of bill"
                />
                <span className="muted" style={{ fontSize: "0.75rem" }}>
                  Rest ({formatMoney(creditBalanceDue)}) will show under Credit dues until collected.
                </span>
              </label>
            ) : null}

            {error ? <AdminAlert>{error}</AdminAlert> : null}

            <button
              type="button"
              className="btn pos-pay-btn"
              disabled={busy || !cart.length}
              onClick={() => void completeSale()}
            >
              {busy
                ? "Processing…"
                : !cart.length && exchange
                  ? "Scan new item to complete exchange"
                  : paymentMethod === "credit"
                    ? creditPaidClamped > 0
                      ? `Save on credit · Collect ${formatMoney(creditPaidClamped)} now`
                      : `Save on credit · Due ${formatMoney(payable)}`
                    : paymentMethod === "cash"
                      ? exchange
                        ? `Complete exchange · Collect ${formatMoney(payable)}`
                        : `Collect ${formatMoney(payable)}`
                      : `Pay ${formatMoney(payable)} with Razorpay`}
            </button>
            {exchange && !cart.length ? (
              <p className="muted" style={{ margin: 0, fontSize: "0.78rem", textAlign: "center" }}>
                Exchange needs at least one new product. Use the scan box on the left.
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {exchangeBrowseOpen ? (
        <div className="pos-invoice-overlay" role="dialog" aria-modal="true">
          <div className="pos-invoice-sheet" style={{ maxWidth: 640 }}>
            <div className="admin-panel-head" style={{ marginBottom: 12 }}>
              <h3>Select invoice to exchange</h3>
              <button
                type="button"
                className="btn admin-ghost-btn"
                onClick={() => setExchangeBrowseOpen(false)}
              >
                <X size={14} />
                Close
              </button>
            </div>
            <form
              className="pos-scan"
              onSubmit={(e) => {
                e.preventDefault();
                const term = exchangeQuery.trim();
                // Enter / scanner submit → search and auto-open if one match.
                void searchExchangeInvoices(term, { autoOpen: Boolean(term) });
              }}
            >
              <label className="pos-scan-field">
                <ScanBarcode size={18} />
                <input
                  value={exchangeQuery}
                  onChange={(e) => setExchangeQuery(e.target.value)}
                  placeholder="Scan bill barcode or type INV-POS-… / mobile / name"
                  autoFocus
                  autoComplete="off"
                  inputMode="search"
                />
              </label>
              <button className="btn" type="submit" disabled={exchangeBusy}>
                {exchangeBusy ? "…" : "Search"}
              </button>
            </form>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.78rem" }}>
              Tip: scan the invoice barcode, or search <code>INV-POS-…</code> /{" "}
              <code>POS-…</code> / last digits / customer mobile.
            </p>
            {error ? (
              <div style={{ marginTop: 10 }}>
                <AdminAlert>{error}</AdminAlert>
              </div>
            ) : null}
            <div className="pos-exchange-invoice-list">
              {!exchangeHits.length ? (
                <AdminEmpty
                  title="No invoices"
                  body="Scan or search a paid store bill to start exchange."
                />
              ) : (
                exchangeHits.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="pos-exchange-invoice-row"
                    onClick={() => void loadInvoiceForExchange(row.id)}
                    disabled={exchangeBusy}
                  >
                    <div>
                      <strong>INV-{row.order_number}</strong>
                      <p className="muted">
                        {row.customer_name || "Walk-in"} · {row.customer_phone || "—"} ·{" "}
                        {row.line_count} item{row.line_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong>{formatMoney(row.total_amount)}</strong>
                      <p className="muted">{formatDate(row.created_at)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {exchangePickOpen && exchangeDraftMeta ? (
        <div className="pos-invoice-overlay" role="dialog" aria-modal="true">
          <div className="pos-invoice-sheet" style={{ maxWidth: 640 }}>
            <div className="admin-panel-head" style={{ marginBottom: 12 }}>
              <h3>Select items to return · {exchangeDraftMeta.orderNumber}</h3>
              <button
                type="button"
                className="btn admin-ghost-btn"
                onClick={() => {
                  setExchangePickOpen(false);
                  setExchangeDraftLines([]);
                  setExchangeDraftMeta(null);
                }}
              >
                <X size={14} />
                Close
              </button>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              This bill has more than one product. Choose what the customer is returning, then add the
              new items on POS.
            </p>
            <div className="pos-exchange-pick-list">
              {exchangeDraftLines.map((line, idx) => (
                <label key={line.orderItemId} className="pos-exchange-pick-row">
                  <input
                    type="checkbox"
                    checked={line.quantity > 0}
                    onChange={(e) => {
                      setExchangeDraftLines((rows) =>
                        rows.map((r, i) =>
                          i === idx
                            ? { ...r, quantity: e.target.checked ? r.maxQty : 0 }
                            : r
                        )
                      );
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong>{line.productName}</strong>
                    <p className="muted">
                      {line.sku || "—"}
                      {line.variantName ? ` · ${line.variantName}` : ""} ·{" "}
                      {formatMoney(line.unitPrice)} each
                    </p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={line.maxQty}
                    value={line.quantity}
                    disabled={line.quantity === 0}
                    onChange={(e) => {
                      const n = Math.max(
                        0,
                        Math.min(line.maxQty, Math.floor(Number(e.target.value) || 0))
                      );
                      setExchangeDraftLines((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, quantity: n } : r))
                      );
                    }}
                    style={{ width: 72 }}
                  />
                </label>
              ))}
            </div>
            <div className="pos-invoice-actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (!exchangeDraftMeta) return;
                  applyExchangeSelection(exchangeDraftMeta, exchangeDraftLines);
                }}
              >
                Continue — add new items
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
