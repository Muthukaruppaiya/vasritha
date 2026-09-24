/**
 * Canonical order / payment status values used by admin, customer, and APIs.
 * Do not invent new values without a DB enum migration and full usage audit.
 */

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled"
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Fulfillment steps staff advance after payment (matches admin pipeline). */
export const ORDER_FULFILLMENT_STATUSES = [
  "confirmed",
  "processing",
  "shipped",
  "delivered"
] as const;

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Customer-facing fulfillment tracker (excludes cancelled). */
export const ORDER_TRACK_STEPS = [
  { key: "pending", label: "Order placed", hint: "We received your order" },
  { key: "confirmed", label: "Confirmed", hint: "Payment verified" },
  { key: "processing", label: "Preparing", hint: "Boutique packing in progress" },
  { key: "shipped", label: "Shipped", hint: "On the way to you" },
  { key: "delivered", label: "Delivered", hint: "Enjoy your Vasritha piece" }
] as const;

export const ORDER_STATUS_RANK: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  shipped: 3,
  delivered: 4,
  cancelled: -1
};

/**
 * Allowed admin/API transitions for orders.status.
 * Payment verify may set pending→confirmed outside this map (system action).
 */
const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: []
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isAllowedOrderTransition(from: string, to: string): boolean {
  if (from === to) return true;
  if (!isOrderStatus(from) || !isOrderStatus(to)) return false;
  return (ORDER_TRANSITIONS[from] || []).includes(to);
}

export function orderStatusLabel(status: string): string {
  if (status === "processing") return "Packing";
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.replace(/_/g, " ").slice(1);
}

export function paymentStatusLabel(status: string): string {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
