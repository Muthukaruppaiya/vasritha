import { NextRequest } from "next/server";
import { ok, requirePermission } from "../../../../../lib/auth/api";
import { query } from "../../../../../lib/db/pool";
import { resolveShopScope } from "../../../../../lib/shop-scope";

/** Outstanding POS credit bills (partial / unpaid store sales). */
export async function GET(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "pos:create");
  if (error || !ctx) return error;

  const { searchParams } = new URL(request.url);
  const q = String(searchParams.get("q") || "").trim();
  const preferredShop = searchParams.get("shopId");
  const scope = await resolveShopScope(ctx, preferredShop);
  const shopId = scope.mode === "one" ? scope.shopId : preferredShop || null;
  const like = q ? `%${q.replace(/\s+/g, "%")}%` : null;

  const rows = await query<{
    order_id: string;
    order_number: string;
    created_at: string;
    total_amount: string;
    paid_amount: string;
    customer_name: string | null;
    customer_phone: string | null;
    customer_id: string | null;
    shop_id: string | null;
    payment_status: string;
  }>(
    `select o.id as order_id, o.order_number, o.created_at, o.total_amount, o.payment_status,
            o.shop_id, o.customer_id,
            coalesce(nullif(o.pos_customer_name, ''), c.full_name, 'Walk-in') as customer_name,
            coalesce(nullif(o.pos_customer_phone, ''), c.phone) as customer_phone,
            coalesce((
              select sum(p.amount) from payments p
              where p.order_id = o.id and p.status = 'paid'
            ), 0)::text as paid_amount
     from orders o
     left join customers c on c.id = o.customer_id
     where coalesce(o.channel, 'online') = 'pos'
       and o.payment_status in ('pending', 'failed')
       and coalesce(o.status, '') not in ('cancelled')
       and ($1::uuid is null or o.shop_id = $1)
       and (
         $2::text is null
         or o.order_number ilike $2
         or coalesce(nullif(o.pos_customer_phone, ''), c.phone, '') ilike $2
         or coalesce(nullif(o.pos_customer_name, ''), c.full_name, '') ilike $2
       )
     order by o.created_at desc
     limit 200`,
    [shopId, like]
  );

  const mapped = rows
    .map((row) => {
      const invoice = Number(row.total_amount);
      const paid = Number(row.paid_amount);
      const outstanding = Math.round(Math.max(0, invoice - paid) * 100) / 100;
      const days = Math.max(
        0,
        Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000)
      );
      return {
        order_id: row.order_id,
        order_number: row.order_number,
        created_at: row.created_at,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        customer_id: row.customer_id,
        shop_id: row.shop_id,
        invoice_amount: invoice,
        paid_amount: paid,
        outstanding_amount: outstanding,
        days_overdue: days,
        status_label:
          paid <= 0 ? (days > 7 ? "Overdue" : "Unpaid") : outstanding > 0 ? "Partially paid" : "Paid"
      };
    })
    .filter((row) => row.outstanding_amount > 0.009);

  const byCustomer = new Map<
    string,
    {
      key: string;
      customer_name: string;
      customer_phone: string | null;
      customer_id: string | null;
      bill_count: number;
      outstanding_amount: number;
      bills: typeof mapped;
    }
  >();

  for (const row of mapped) {
    const key = row.customer_phone || row.customer_id || row.order_id;
    const existing = byCustomer.get(key);
    if (existing) {
      existing.bill_count += 1;
      existing.outstanding_amount =
        Math.round((existing.outstanding_amount + row.outstanding_amount) * 100) / 100;
      existing.bills.push(row);
    } else {
      byCustomer.set(key, {
        key,
        customer_name: row.customer_name || "Walk-in",
        customer_phone: row.customer_phone,
        customer_id: row.customer_id,
        bill_count: 1,
        outstanding_amount: row.outstanding_amount,
        bills: [row]
      });
    }
  }

  const customers = Array.from(byCustomer.values()).sort(
    (a, b) => b.outstanding_amount - a.outstanding_amount
  );
  const totals = {
    outstanding: Math.round(
      customers.reduce((sum, c) => sum + c.outstanding_amount, 0) * 100
    ) / 100,
    customer_count: customers.length,
    bill_count: mapped.length
  };

  return ok({ rows: mapped, customers, totals });
}
