import { NextRequest } from "next/server";
import { ok, requireAnyPermission } from "../../../../lib/auth/api";
import { query } from "../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "customers:search",
    "customers:support",
    "customers:manage"
  ]);
  if (error) return error;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? null;
  const like = q ? `%${q}%` : null;

  // Storefront shoppers only — exclude accounts that also hold a staff role.
  const data = await query<{
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    created_at: string;
    order_count: string;
    total_spent: string;
    last_order_at: string | null;
  }>(
    `select
       u.id,
       u.full_name,
       u.email,
       u.phone,
       u.created_at,
       coalesce(o.order_count, 0)::text as order_count,
       coalesce(o.total_spent, 0)::text as total_spent,
       o.last_order_at
     from users u
     left join lateral (
       select
         count(*)::int as order_count,
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
     order by u.created_at desc
     limit 100`,
    [like]
  );

  return ok(data);
}
