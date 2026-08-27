"use client";

import { getStoreToken, storeFetch } from "./store-api";

export type CartItem = {
  productId: string;
  variantId?: string | null;
  slug: string;
  name: string;
  shortName?: string;
  size: string;
  quantity: number;
  price: number;
  compareAtPrice?: number;
  imageSrc: string;
  type?: string;
  /** ISO timestamp when soft stock hold ends */
  reservedUntil?: string | null;
};

const CART_KEY = "vasritha_cart_v2";
const SESSION_KEY = "vasritha_cart_session";
export const CART_EVENT = "vasritha:cart";
export const CART_HOLD_MINUTES = 30;

function emitCartChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CART_EVENT));
}

export function getCartSessionKey() {
  if (typeof window === "undefined") return "";
  let key = window.localStorage.getItem(SESSION_KEY);
  if (!key) {
    key =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(SESSION_KEY, key);
  }
  return key;
}

export function getCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.productId && item.quantity > 0);
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  emitCartChange();
}

export function getCartCount() {
  return getCartItems().reduce((sum, item) => sum + item.quantity, 0);
}

async function reserveOnServer(input: {
  productId: string;
  variantId?: string | null;
  quantity: number;
}) {
  const sessionKey = getCartSessionKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Cart-Session": sessionKey
  };
  const token = getStoreToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch("/api/cart/reservations", {
    method: "POST",
    headers,
    body: JSON.stringify({
      sessionKey,
      productId: input.productId,
      variantId: input.variantId ?? null,
      quantity: input.quantity
    })
  });
  const payload = (await res.json().catch(() => null)) as {
    data?: { reservedUntil?: string | null; quantity?: number; available?: number };
    error?: string;
  } | null;

  if (!res.ok) {
    throw new Error(payload?.error || "Could not reserve stock for this item");
  }
  return payload?.data || { reservedUntil: null, quantity: input.quantity, available: 0 };
}

export async function addToCart(
  item: Omit<CartItem, "quantity"> & { quantity?: number }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const quantity = Math.max(1, item.quantity ?? 1);
  const items = getCartItems();
  const existing = items.find(
    (entry) =>
      entry.productId === item.productId &&
      (entry.variantId ?? null) === (item.variantId ?? null)
  );
  const nextQty = (existing?.quantity || 0) + quantity;

  try {
    const hold = await reserveOnServer({
      productId: item.productId,
      variantId: item.variantId,
      quantity: nextQty
    });

    if (existing) {
      existing.quantity = nextQty;
      existing.reservedUntil = hold.reservedUntil || existing.reservedUntil;
    } else {
      items.push({
        productId: item.productId,
        variantId: item.variantId ?? null,
        slug: item.slug,
        name: item.name,
        shortName: item.shortName,
        size: item.size,
        quantity: nextQty,
        price: item.price,
        compareAtPrice: item.compareAtPrice,
        imageSrc: item.imageSrc,
        type: item.type,
        reservedUntil: hold.reservedUntil
      });
    }
    saveCart(items);

    if (getStoreToken()) {
      void storeFetch("/api/customer/cart", {
        method: "POST",
        json: {
          productId: item.productId,
          variantId: item.variantId ?? undefined,
          quantity
        }
      });
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Out of stock" };
  }
}

export async function updateCartQuantity(
  productId: string,
  variantId: string | null | undefined,
  quantity: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nextQty = Math.max(0, Math.trunc(quantity));
  try {
    const hold = await reserveOnServer({
      productId,
      variantId,
      quantity: nextQty
    });

    const next = getCartItems()
      .map((item) =>
        item.productId === productId && (item.variantId ?? null) === (variantId ?? null)
          ? {
              ...item,
              quantity: nextQty,
              reservedUntil: hold.reservedUntil
            }
          : item
      )
      .filter((item) => item.quantity > 0);
    saveCart(next);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not update quantity" };
  }
}

export async function removeFromCart(productId: string, variantId?: string | null) {
  await reserveOnServer({ productId, variantId, quantity: 0 }).catch(() => null);
  saveCart(
    getCartItems().filter(
      (item) =>
        !(item.productId === productId && (item.variantId ?? null) === (variantId ?? null))
    )
  );
}

export async function clearCart() {
  const sessionKey = getCartSessionKey();
  const headers: Record<string, string> = { "X-Cart-Session": sessionKey };
  const token = getStoreToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  await fetch(`/api/cart/reservations?sessionKey=${encodeURIComponent(sessionKey)}`, {
    method: "DELETE",
    headers
  }).catch(() => null);
  saveCart([]);
}

export function parsePrice(value: string | number | undefined | null) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const digits = String(value).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatHoldRemaining(reservedUntil?: string | null) {
  if (!reservedUntil) return null;
  const end = new Date(reservedUntil).getTime();
  if (Number.isNaN(end)) return null;
  const ms = end - Date.now();
  if (ms <= 0) return "Hold expired — remove & add again to reserve";
  const totalSec = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, "0")} left on hold`;
}

/** Drop expired local lines and release (server already auto-releases). */
export function pruneExpiredCartItems() {
  const now = Date.now();
  const items = getCartItems();
  const next = items.filter((item) => {
    if (!item.reservedUntil) return true;
    const end = new Date(item.reservedUntil).getTime();
    return Number.isNaN(end) || end > now;
  });
  if (next.length !== items.length) saveCart(next);
  return next;
}

export async function mergeLocalCartToServer() {
  if (!getStoreToken()) return;
  const items = getCartItems();
  for (const item of items) {
    await reserveOnServer({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity
    }).catch(() => null);
    await storeFetch("/api/customer/cart", {
      method: "POST",
      json: {
        productId: item.productId,
        variantId: item.variantId ?? undefined,
        quantity: item.quantity
      }
    });
  }
}

/** Sync local reservedUntil from server without extending the timer. */
export async function syncCartHoldTimers() {
  const items = pruneExpiredCartItems();
  const sessionKey = getCartSessionKey();
  const res = await fetch("/api/cart/reservations", {
    headers: { "X-Cart-Session": sessionKey }
  }).catch(() => null);
  if (!res?.ok) return items;
  const payload = (await res.json().catch(() => null)) as {
    data?: {
      reservations?: Array<{
        productId: string;
        variantId: string | null;
        quantity: number;
        reservedUntil: string;
      }>;
    };
  } | null;
  const holds = payload?.data?.reservations || [];
  for (const item of items) {
    const match = holds.find(
      (row) =>
        row.productId === item.productId &&
        (row.variantId || null) === (item.variantId || null)
    );
    item.reservedUntil = match?.reservedUntil || item.reservedUntil || null;
  }
  saveCart(items);
  return items;
}
