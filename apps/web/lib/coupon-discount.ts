/** Shared coupon discount math — used by orders, validate, and offer-progress UI. */

export type CouponDiscountInput = {
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  subtotal: number;
};

export function computeCouponDiscount(input: CouponDiscountInput) {
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

export type OfferProgress = {
  /** True when cart meets min order (discount may still be rejected by usage/date on server). */
  unlocked: boolean;
  minOrderAmount: number;
  currentAmount: number;
  remainingAmount: number;
  progressPercent: number;
  /** Estimated discount if unlocked — display only; checkout re-validates. */
  estimatedDiscount: number | null;
  benefitLabel: string;
};

/** Progress toward coupon min_order_amount. Does not apply the discount. */
export function evaluateCouponProgress(input: {
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  subtotal: number;
  headline?: string | null;
  code?: string | null;
}): OfferProgress {
  const min = Math.max(0, Number(input.minOrderAmount) || 0);
  const current = Math.max(0, Number(input.subtotal) || 0);
  const remaining = min > 0 ? Math.max(0, Math.ceil(min - current)) : 0;
  const unlocked = min <= 0 || current >= min;
  const progressPercent =
    min <= 0 ? 100 : Math.min(100, Math.round((current / min) * 100));

  const benefitLabel =
    input.headline?.trim() ||
    (input.discountType === "percentage"
      ? `${input.discountValue}% off`
      : `₹${Number(input.discountValue).toLocaleString("en-IN")} off`);

  let estimatedDiscount: number | null = null;
  if (unlocked) {
    const result = computeCouponDiscount({
      discountType: input.discountType,
      discountValue: input.discountValue,
      minOrderAmount: input.minOrderAmount,
      maxDiscountAmount: input.maxDiscountAmount,
      subtotal: input.subtotal
    });
    estimatedDiscount = result.ok ? result.discount : null;
  }

  return {
    unlocked,
    minOrderAmount: min,
    currentAmount: Number(current.toFixed(2)),
    remainingAmount: remaining,
    progressPercent,
    estimatedDiscount,
    benefitLabel
  };
}

export function formatOfferBenefit(input: {
  discountType: string;
  discountValue: number;
  headline?: string | null;
}) {
  if (input.headline?.trim()) return input.headline.trim();
  if (input.discountType === "percentage") return `${input.discountValue}% off`;
  return `₹${Number(input.discountValue).toLocaleString("en-IN")} off`;
}
