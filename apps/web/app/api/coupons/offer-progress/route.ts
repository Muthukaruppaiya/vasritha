import { NextRequest } from "next/server";
import { fail, ok } from "../../../../lib/auth/api";
import { queryOne } from "../../../../lib/db/pool";
import { evaluateCouponProgress, formatOfferBenefit } from "../../../../lib/coupon-discount";

export const dynamic = "force-dynamic";

type CouponRow = {
  id: string;
  code: string;
  headline: string | null;
  description: string | null;
  discount_type: string;
  discount_value: string;
  min_order_amount: string;
  max_discount_amount: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  show_on_open: boolean;
};

function mapProgress(row: CouponRow, subtotal: number, source: string) {
  const now = Date.now();
  if (row.status !== "active") {
    return {
      applicable: false,
      reason: "inactive" as const,
      coupon: null,
      progress: null
    };
  }
  if (row.starts_at && new Date(row.starts_at).getTime() > now) {
    return {
      applicable: false,
      reason: "not_started" as const,
      coupon: null,
      progress: null
    };
  }
  if (row.ends_at && new Date(row.ends_at).getTime() < now) {
    return {
      applicable: false,
      reason: "expired" as const,
      coupon: null,
      progress: null
    };
  }

  const minOrderAmount = Number(row.min_order_amount || 0);
  if (minOrderAmount <= 0) {
    return {
      applicable: false,
      reason: "no_minimum" as const,
      coupon: {
        id: row.id,
        code: row.code,
        headline: row.headline,
        benefitLabel: formatOfferBenefit({
          discountType: row.discount_type,
          discountValue: Number(row.discount_value),
          headline: row.headline
        }),
        minOrderAmount: 0
      },
      progress: null
    };
  }

  const progress = evaluateCouponProgress({
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    minOrderAmount,
    maxDiscountAmount:
      row.max_discount_amount != null ? Number(row.max_discount_amount) : null,
    subtotal,
    headline: row.headline,
    code: row.code
  });

  return {
    applicable: true,
    reason: progress.unlocked ? ("unlocked" as const) : ("below_minimum" as const),
    source,
    coupon: {
      id: row.id,
      code: row.code,
      headline: row.headline,
      benefitLabel: progress.benefitLabel,
      discountType: row.discount_type,
      discountValue: Number(row.discount_value),
      minOrderAmount,
      maxDiscountAmount:
        row.max_discount_amount != null ? Number(row.max_discount_amount) : null
    },
    progress
  };
}

/**
 * Read-only offer progress for cart / checkout UI.
 * Does NOT apply a discount — checkout still validates via computeCouponDiscount.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subtotal = Math.max(0, Number(searchParams.get("subtotal") || 0));
    const code = (searchParams.get("code") || "").trim().toUpperCase();

    let row: CouponRow | null = null;
    let source = "none";

    if (code) {
      row = await queryOne<CouponRow>(
        `select id, code, headline, description, discount_type, discount_value,
                min_order_amount, max_discount_amount, status, starts_at, ends_at,
                coalesce(show_on_open, false) as show_on_open
         from coupons
         where upper(code) = $1
         limit 1`,
        [code]
      );
      source = "applied";
    }

    if (!row) {
      // Prefer the boutique opening offer (existing priority for storefront vouchers).
      row = await queryOne<CouponRow>(
        `select id, code, headline, description, discount_type, discount_value,
                min_order_amount, max_discount_amount, status, starts_at, ends_at,
                coalesce(show_on_open, false) as show_on_open
         from coupons
         where status = 'active'
           and coalesce(show_on_open, false) = true
           and coalesce(min_order_amount, 0) > 0
           and (starts_at is null or starts_at <= now())
           and (ends_at is null or ends_at >= now())
         order by created_at desc
         limit 1`
      );
      source = "opening";
    }

    if (!row) {
      // Next: active coupon with a min order closest above current cart (or lowest min).
      row = await queryOne<CouponRow>(
        `select id, code, headline, description, discount_type, discount_value,
                min_order_amount, max_discount_amount, status, starts_at, ends_at,
                coalesce(show_on_open, false) as show_on_open
         from coupons
         where status = 'active'
           and coalesce(min_order_amount, 0) > 0
           and (starts_at is null or starts_at <= now())
           and (ends_at is null or ends_at >= now())
         order by
           case when min_order_amount > $1 then 0 else 1 end,
           abs(min_order_amount - $1) asc,
           created_at desc
         limit 1`,
        [subtotal]
      );
      source = "active";
    }

    if (!row) {
      return ok({
        applicable: false,
        reason: "none",
        coupon: null,
        progress: null
      });
    }

    return ok(mapProgress(row, subtotal, source));
  } catch (err) {
    console.error("[coupons/offer-progress]", err);
    return fail("Could not load offer progress", 500);
  }
}
