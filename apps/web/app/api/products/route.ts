import { ok } from "../../../lib/auth/api";
import { query } from "../../../lib/db/pool";

export async function GET() {
  const data = await query(
    `select id, name, slug, description, price, compare_at_price, stock_quantity, status
     from products
     where status = 'active'
     order by created_at desc`
  );
  return ok(data);
}
