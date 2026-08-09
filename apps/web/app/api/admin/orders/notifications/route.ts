import { NextRequest } from "next/server";
import { ok, requireAnyPermission } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "orders:view",
    "orders:manage",
    "orders:fulfill"
  ]);
  if (error) return error;

  const [counts, recent] = await Promise.all([
    queryOne<{
      active_count: string;
      pending_count: string;
    }>(
      `select
         count(*) filter (
           where status::text in ('pending', 'confirmed', 'processing')
         )::text as active_count,
         count(*) filter (
           where status::text = 'pending'
         )::text as pending_count
       from orders
       where coalesce(channel, 'online') = 'online'
         and status::text <> 'cancelled'`
    ),
    query<{
      id: string;
      order_number: string;
      status: string;
      total_amount: string;
      created_at: string;
      customer_name: string | null;
      customer_email: string | null;
    }>(
      `select o.id, o.order_number, o.status::text as status, o.total_amount, o.created_at,
              c.full_name as customer_name, c.email as customer_email
       from orders o
       left join customers c on c.id = o.customer_id
       where coalesce(o.channel, 'online') = 'online'
         and o.status::text <> 'cancelled'
       order by o.created_at desc
       limit 12`
    )
  ]);

  return ok({
    activeCount: Number(counts?.active_count || 0),
    pendingCount: Number(counts?.pending_count || 0),
    recent
  });
}
