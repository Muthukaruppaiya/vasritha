import { NextResponse } from "next/server";
import { ok } from "../../../../lib/auth/api";
import { queryOne } from "../../../../lib/db/pool";

export const dynamic = "force-dynamic";

export async function GET() {
  const row = await queryOne<{
    id: string;
    code: string;
    headline: string | null;
    description: string | null;
    discount_type: string;
    discount_value: string;
    min_order_amount: string;
    max_discount_amount: string | null;
    ends_at: string | null;
  }>(
    `select id, code, headline, description, discount_type, discount_value,
            min_order_amount, max_discount_amount, ends_at
     from coupons
     where status = 'active'
       and show_on_open = true
       and (starts_at is null or starts_at <= now())
       and (ends_at is null or ends_at >= now())
     order by created_at desc
     limit 1`
  );

  if (!row) {
    return NextResponse.json(
      { data: { voucher: null } },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  return NextResponse.json(
    {
      data: {
        voucher: {
          id: row.id,
          code: row.code,
          headline: row.headline || "Gift voucher",
          description: row.description || "",
          discountType: row.discount_type,
          discountValue: Number(row.discount_value),
          minOrderAmount: Number(row.min_order_amount),
          maxDiscountAmount:
            row.max_discount_amount != null ? Number(row.max_discount_amount) : null,
          endsAt: row.ends_at
        }
      }
    },
    {
      status: 200,
      headers: { "Cache-Control": "private, max-age=30" }
    }
  );
}
