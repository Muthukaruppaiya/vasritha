"use client";

import { getStoreToken, storeFetch } from "./store-api";

export type CartItem = {
  productId: string;
  variantId?: string | null;
  slug: string;
  name: string;
  size: string;
  quantity: number;
  price: number;
  compareAtPrice?: number;
  imageSrc: string;
  type?: string;
};

const CART_KEY = "vasritha_cart_v2";
export const CART_EVENT = "vasritha:cart";

function emitCartChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CART_EVENT));
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

export function addToCart(item: Omit<CartItem, "quantity"> & { quantity?: number }) {
  const quantity = Math.max(1, item.quantity ?? 1);
  const items = getCartItems();
  const existing = items.find(
    (entry) =>
      entry.productId === item.productId &&
      (entry.variantId ?? null) === (item.variantId ?? null)
  );

  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({
      productId: item.productId,
      variantId: item.variantId ?? null,
      slug: item.slug,
      name: item.name,
      size: item.size,
      quantity,
      price: item.price,
      compareAtPrice: item.compareAtPrice,
      imageSrc: item.imageSrc,
      type: item.type
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
}

export function updateCartQuantity(
  productId: string,
  variantId: string | null | undefined,
  quantity: number
) {
  const next = getCartItems()
    .map((item) =>
      item.productId === productId && (item.variantId ?? null) === (variantId ?? null)
        ? { ...item, quantity }
        : item
    )
    .filter((item) => item.quantity > 0);
  saveCart(next);
}

export function removeFromCart(productId: string, variantId?: string | null) {
  saveCart(
    getCartItems().filter(
      (item) =>
        !(item.productId === productId && (item.variantId ?? null) === (variantId ?? null))
    )
  );
}

export function clearCart() {
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

export async function mergeLocalCartToServer() {
  if (!getStoreToken()) return;
  const items = getCartItems();
  for (const item of items) {
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
