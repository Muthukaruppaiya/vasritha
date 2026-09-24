import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../../lib/auth/api";
import { queryOne } from "../../../../../lib/db/pool";
import { computeCouponDiscount } from "../../../../../lib/coupon-discount";

type Coupon = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  min_order_amount: string;
  max_discount_amount: string | null;
  usage_limit: number | null;
  usage_limit_per_customer: number | null;
  starts_at: string | null;
  ends_at: string | null;
};

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "checkout:own");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    code?: string;
    subtotal?: number;
  } | null;

  if (!body?.code || body.subtotal == null) return fail("code and subtotal are required");

  const coupon = await queryOne<Coupon>(
    `select * from coupons where code = $1 and status = 'active'`,
    [body.code.toUpperCase()]
  );

  if (!coupon) return fail("Invalid coupon", 404);

  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) return fail("Coupon not started");
  if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now) return fail("Coupon expired");

  if (coupon.usage_limit != null) {
    const total = await queryOne<{ count: string }>(
      `select count(*)::text as count from coupon_usage where coupon_id = $1`,
      [coupon.id]
    );
    if (Number(total?.count || 0) >= coupon.usage_limit) {
      return fail("Voucher usage limit reached");
    }
  }
  if (coupon.usage_limit_per_customer != null) {
    const perCustomer = await queryOne<{ count: string }>(
      `select count(*)::text as count from coupon_usage where coupon_id = $1 and customer_id = $2`,
      [coupon.id, ctx.userId]
    );
    if (Number(perCustomer?.count || 0) >= coupon.usage_limit_per_customer) {
      return fail("You have already used this voucher the maximum number of times");
    }
  }

  const priced = computeCouponDiscount({
    discountType: coupon.discount_type,
    discountValue: Number(coupon.discount_value),
    minOrderAmount: Number(coupon.min_order_amount),
    maxDiscountAmount:
      coupon.max_discount_amount != null ? Number(coupon.max_discount_amount) : null,
    subtotal: Number(body.subtotal)
  });
  if (!priced.ok) return fail(priced.error);

  return ok({
    couponId: coupon.id,
    code: coupon.code,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    discountAmount: priced.discount,
    minOrderAmount: Number(coupon.min_order_amount)
  });
}
