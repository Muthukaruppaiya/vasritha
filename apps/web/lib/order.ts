"use client";

import { CartItem, clearCart, formatPrice, getCartItems } from "./cart";

export type OrderLine = {
  productId: string;
  variantId?: string | null;
  slug: string;
  name: string;
  shortName?: string;
  type: string;
  size: string;
  quantity: number;
  price: string;
  compareAtPrice?: string;
  imageSrc: string;
  lineTotal: number;
};

export type PlacedOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  paymentMethod: string;
  paymentStatus: "paid" | "pending";
  total: number;
  savings: number;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: OrderLine[];
};

const PENDING_KEY = "vasritha_pending_order_v2";
const LAST_ORDER_KEY = "vasritha_last_order_v2";

export type PendingOrder = {
  fromCart: boolean;
  shippingAddressId: string;
  items: Array<{
    productId: string;
    variantId?: string | null;
    slug: string;
    name: string;
    shortName?: string;
    type?: string;
    size: string;
    quantity: number;
    price: number;
    compareAtPrice?: number;
    imageSrc: string;
  }>;
};

export function buildOrderLines(pending: PendingOrder): OrderLine[] {
  return pending.items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    slug: item.slug,
    name: item.name,
    shortName: item.shortName || item.name,
    type: item.type || "",
    size: item.size,
    quantity: item.quantity,
    price: formatPrice(item.price),
    compareAtPrice:
      item.compareAtPrice != null ? formatPrice(item.compareAtPrice * item.quantity) : undefined,
    imageSrc: item.imageSrc,
    lineTotal: item.price * item.quantity
  }));
}

export function savePendingOrder(pending: PendingOrder) {
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function getPendingOrder(): PendingOrder | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingOrder;
  } catch {
    return null;
  }
}

export function clearPendingOrder() {
  window.localStorage.removeItem(PENDING_KEY);
}

export function createPendingFromCheckout(params: {
  fromCart: boolean;
  shippingAddressId: string;
  items: PendingOrder["items"];
}) {
  savePendingOrder({
    fromCart: params.fromCart,
    shippingAddressId: params.shippingAddressId,
    items: params.items
  });
}

export function saveLastOrder(order: PlacedOrder) {
  window.localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
  clearPendingOrder();
  if (getPendingOrder()?.fromCart || order) {
    // clear cart when order came from bag — caller also clears when fromCart
  }
}

export function finalizeLocalOrder(order: PlacedOrder, fromCart: boolean) {
  window.localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
  clearPendingOrder();
  if (fromCart) clearCart();
}

export function getLastOrder(): PlacedOrder | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_ORDER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlacedOrder;
  } catch {
    return null;
  }
}

export function getOrderById(orderId: string): PlacedOrder | null {
  const order = getLastOrder();
  if (!order) return null;
  if (order.id === orderId || order.orderNumber === orderId) return order;
  return null;
}

export function cartItemsToPendingLines(items: CartItem[]): PendingOrder["items"] {
  return items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    slug: item.slug,
    name: item.name,
    shortName: item.shortName || item.name,
    type: item.type,
    size: item.size,
    quantity: item.quantity,
    price: item.price,
    compareAtPrice: item.compareAtPrice,
    imageSrc: item.imageSrc
  }));
}

export { formatPrice };
