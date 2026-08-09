import { NextRequest } from "next/server";
import { ok, requireAnyPermission } from "../../../../lib/auth/api";
import { query } from "../../../../lib/db/pool";
import { WALK_IN_EMAIL } from "../../../../lib/pos";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "customers:search",
    "customers:support",
    "customers:manage"
  ]);
  if (error) return error;

  const searchParams = new URL(request.url).searchParams;
  const q = searchParams.get("q")?.trim() ?? null;
  const type = searchParams.get("type")?.trim() || null;
  const like = q ? `%${q}%` : null;
  const typeFilter = type === "online" || type === "offline" ? type : null;

  // Storefront shoppers only — exclude accounts that also hold a staff role.
  // Offline = walk-in POS customer, or customers with only in-store (pos) orders.
  const data = await query<{
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    created_at: string;
    order_count: string;
    total_spent: string;
    last_order_at: string | null;
    customer_channel: "online" | "offline";
  }>(
    `with base as (
       select
         u.id,
         u.full_name,
         u.email,
         u.phone,
         u.created_at,
         coalesce(o.order_count, 0)::text as order_count,
         coalesce(o.total_spent, 0)::text as total_spent,
         o.last_order_at,
         case
           when lower(u.email) = lower($2)
             then 'offline'
           when coalesce(o.online_orders, 0) = 0
            and coalesce(o.pos_orders, 0) > 0
             then 'offline'
           else 'online'
         end as customer_channel
       from users u
       left join lateral (
         select
           count(*)::int as order_count,
           count(*) filter (where coalesce(channel, 'online') = 'online')::int as online_orders,
           count(*) filter (where coalesce(channel, 'online') = 'pos')::int as pos_orders,
           coalesce(sum(total_amount), 0) as total_spent,
           max(created_at) as last_order_at
         from orders
         where customer_id = u.id
       ) o on true
       where exists (
         select 1
         from user_roles ur
         join roles r on r.id = ur.role_id
         where ur.user_id = u.id and r.code = 'customer'
       )
       and not exists (
         select 1
         from user_roles ur2
         join roles r2 on r2.id = ur2.role_id
         where ur2.user_id = u.id and r2.code <> 'customer'
       )
       and ($1::text is null or u.full_name ilike $1 or u.email ilike $1 or u.phone ilike $1)
     )
     select *
     from base
     where ($3::text is null or customer_channel = $3)
     order by created_at desc
     limit 100`,
    [like, WALK_IN_EMAIL, typeFilter]
  );

  return ok(data);
}
