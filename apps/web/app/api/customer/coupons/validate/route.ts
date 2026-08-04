import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../../lib/auth/api";
import { queryOne } from "../../../../../lib/db/pool";

type Coupon = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  min_order_amount: string;
  max_discount_amount: string | null;
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
  if (Number(body.subtotal) < Number(coupon.min_order_amount)) {
    return fail(`Minimum order amount is ${coupon.min_order_amount}`);
  }

  let discount =
    coupon.discount_type === "percentage"
      ? (Number(body.subtotal) * Number(coupon.discount_value)) / 100
      : Number(coupon.discount_value);

  if (coupon.max_discount_amount != null) {
    discount = Math.min(discount, Number(coupon.max_discount_amount));
  }
  discount = Math.min(discount, Number(body.subtotal));

  return ok({
    couponId: coupon.id,
    code: coupon.code,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    discountAmount: Number(discount.toFixed(2))
  });
}
