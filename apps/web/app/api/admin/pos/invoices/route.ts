import { NextRequest } from "next/server";
import { ok, requirePermission } from "../../../../../lib/auth/api";
import { query } from "../../../../../lib/db/pool";
import { resolveShopScope } from "../../../../../lib/shop-scope";

/** Normalize printed bill codes like INV-POS-81471344 → POS-81471344. */
function normalizeInvoiceQuery(raw: string) {
  let q = String(raw || "").trim();
  if (!q) return "";
  // Strip common printed prefixes / separators from thermal / A4 bills.
  q = q.replace(/^INV[-\s]*/i, "");
  q = q.replace(/\s+/g, "");
  return q;
}

/** Search paid POS invoices for in-store exchange (text or scanned bill no.). */
export async function GET(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "pos:create");
  if (error || !ctx) return error;

  const { searchParams } = new URL(request.url);
  const rawQ = String(searchParams.get("q") || "").trim();
  const preferredShop = searchParams.get("shopId");
  const scope = await resolveShopScope(ctx, preferredShop);
  const shopId = scope.mode === "one" ? scope.shopId : preferredShop || null;

  const normalized = normalizeInvoiceQuery(rawQ);
  const like = normalized ? `%${normalized.replace(/\s+/g, "%")}%` : null;
  // Also try the digits-only tail (scanner / typed bill numbers).
  const digits = normalized.replace(/\D/g, "");
  const digitLike = digits.length >= 4 ? `%${digits}%` : null;

  const data = await query(
    `select o.id, o.order_number, o.created_at, o.total_amount, o.subtotal,
            o.payment_status, o.status::text as status, o.shop_id,
            coalesce(nullif(o.pos_customer_name, ''), c.full_name) as customer_name,
            coalesce(nullif(o.pos_customer_phone, ''), c.phone) as customer_phone,
            (select count(*)::int from order_items oi where oi.order_id = o.id) as line_count
     from orders o
     left join customers c on c.id = o.customer_id
     where coalesce(o.channel, 'online') = 'pos'
       and o.payment_status = 'paid'
       and o.status::text not in ('cancelled')
       and ($1::uuid is null or o.shop_id = $1 or o.shop_id is null)
       and (
         $2::text is null
         or o.order_number ilike $2
         or ('INV-' || o.order_number) ilike $2
         or ('INV-' || o.order_number) ilike ('%' || $3 || '%')
         or o.order_number ilike ('%' || $3 || '%')
         or ($4::text is not null and o.order_number ilike $4)
         or coalesce(nullif(o.pos_customer_phone, ''), c.phone, '') ilike $2
         or coalesce(nullif(o.pos_customer_name, ''), c.full_name, '') ilike $2
         or coalesce(nullif(o.pos_customer_phone, ''), c.phone, '') ilike ('%' || $3 || '%')
         or coalesce(nullif(o.pos_customer_name, ''), c.full_name, '') ilike ('%' || $3 || '%')
       )
     order by o.created_at desc
     limit 40`,
    [shopId, like, normalized || null, digitLike]
  );

  return ok(data);
}
