export function computeCouponDiscount(input: {
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  subtotal: number;
}) {
  if (input.subtotal < input.minOrderAmount) {
    return { ok: false as const, error: `Minimum order amount is ₹${input.minOrderAmount}` };
  }
  let discount =
    input.discountType === "percentage"
      ? (input.subtotal * input.discountValue) / 100
      : input.discountValue;
  if (input.maxDiscountAmount != null) {
    discount = Math.min(discount, input.maxDiscountAmount);
  }
  discount = Math.min(Math.max(0, discount), input.subtotal);
  return { ok: true as const, discount: Number(discount.toFixed(2)) };
}
