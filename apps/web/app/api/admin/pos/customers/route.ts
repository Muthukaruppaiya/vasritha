import { NextRequest } from "next/server";
import { ok, requirePermission } from "../../../../../lib/auth/api";
import { query } from "../../../../../lib/db/pool";
import { WALK_IN_EMAIL } from "../../../../../lib/pos";

/**
 * POS customer lookup by mobile (partial or full).
 * Returns matching storefront customers for autocomplete.
 */
export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "pos:create");
  if (error) return error;

  const raw = new URL(request.url).searchParams.get("q")?.trim() || "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 3) return ok([]);

  const like = `%${digits}%`;

  const data = await query<{
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  }>(
    `select c.id, c.full_name, c.email, c.phone
     from customers c
     where exists (
       select 1
       from user_roles ur
       join roles r on r.id = ur.role_id
       where ur.user_id = c.id and r.code = 'customer'
     )
     and not exists (
       select 1
       from user_roles ur2
       join roles r2 on r2.id = ur2.role_id
       where ur2.user_id = c.id and r2.code <> 'customer'
     )
     and c.phone is not null
     and regexp_replace(c.phone, '\\D', '', 'g') like $1
     and lower(c.email) <> lower($2)
     order by
       case
         when regexp_replace(c.phone, '\\D', '', 'g') = $3 then 0
         when regexp_replace(c.phone, '\\D', '', 'g') like $4 then 1
         else 2
       end,
       c.full_name asc
     limit 8`,
    [like, WALK_IN_EMAIL, digits, `${digits}%`]
  );

  return ok(
    data.map((row) => {
      const email = row.email || "";
      const hideEmail =
        email.includes("@pos.local") || email.includes("@customer.vasritha.local");
      return {
        id: row.id,
        fullName: row.full_name,
        email: hideEmail ? "" : email,
        phone: (row.phone || "").replace(/\D/g, "").slice(-10)
      };
    })
  );
}
