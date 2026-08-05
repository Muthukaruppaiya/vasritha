import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "orders:own");
  if (error || !ctx) return error;

  const { id } = await params;

  const order = await queryOne<{
    id: string;
    order_number: string;
    status: string;
    payment_status: string;
    subtotal: string;
    tax_amount: string;
    shipping_amount: string;
    total_amount: string;
    created_at: string;
    shipping_address_id: string | null;
  }>(
    `select id, order_number, status, payment_status, subtotal, tax_amount, shipping_amount,
            total_amount, created_at, shipping_address_id
     from orders
     where id = $1 and customer_id = $2`,
    [id, ctx.userId]
  );

  if (!order) return fail("Order not found", 404);

  const [items, address, payment] = await Promise.all([
    query(
      `select id, product_name, variant_name, sku, unit_price, quantity, line_total, product_id
       from order_items
       where order_id = $1
       order by product_name asc`,
      [order.id]
    ),
    order.shipping_address_id
      ? queryOne(
          `select recipient_name, phone, line1, line2, city, state, postal_code, country
           from addresses where id = $1 and customer_id = $2`,
          [order.shipping_address_id, ctx.userId]
        )
      : Promise.resolve(null),
    queryOne(
      `select provider, provider_payment_id, amount, status, created_at
       from payments where order_id = $1 order by created_at desc limit 1`,
      [order.id]
    )
  ]);

  return ok({
    ...order,
    order_items: items,
    shipping_address: address,
    payment
  });
}
