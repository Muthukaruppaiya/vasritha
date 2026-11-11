import { round2 } from "./gst-math";

/**
 * Fraction of the bill's line value the customer actually paid after the cashier
 * discount (GST is inside the prices, so it is covered too). Exchange credit from an
 * earlier return is not a discount — it was paid in goods — so it is not deducted.
 */
export function paidShareOfBill(subtotal: unknown, cashierDiscount: unknown) {
  const sub = Number(subtotal) || 0;
  if (sub <= 0) return 1;
  const discount = Math.min(sub, Math.max(0, Number(cashierDiscount) || 0));
  return (sub - discount) / sub;
}

/** Credit per returned piece: what the customer paid for it on the original bill. */
export function exchangeCreditPerUnit(unitPrice: unknown, paidShare: number) {
  return round2((Number(unitPrice) || 0) * paidShare);
}
