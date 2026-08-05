import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(request, [
    "orders:view",
    "orders:manage",
    "pos:create"
  ]);
  if (error) return error;

  const { id } = await context.params;
  const order = await queryOne<{
    id: string;
    order_number: string;
    customer_id: string;
    shipping_address_id: string | null;
    status: string;
    payment_status: string;
    subtotal: string;
    discount_amount: string;
    tax_amount: string;
    shipping_amount: string;
    total_amount: string;
    channel: string;
    created_at: string;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
  }>(
    `select o.id, o.order_number, o.customer_id, o.shipping_address_id,
            o.status, o.payment_status, o.subtotal,
            coalesce(o.discount_amount, 0) as discount_amount,
            o.tax_amount, o.shipping_amount, o.total_amount,
            coalesce(o.channel, 'online') as channel, o.created_at,
            c.full_name as customer_name, c.email as customer_email, c.phone as customer_phone
     from orders o
     left join customers c on c.id = o.customer_id
     where o.id = $1`,
    [id]
  );
  if (!order) return fail("Order not found", 404);

  const [items, shippingAddress, payment] = await Promise.all([
    query<{
      product_id: string;
      product_name: string;
      variant_name: string | null;
      sku: string | null;
      unit_price: string;
      quantity: number;
      line_total: string;
    }>(
      `select product_id, product_name, variant_name, sku, unit_price, quantity, line_total
       from order_items where order_id = $1 order by product_name asc`,
      [id]
    ),
    order.shipping_address_id
      ? queryOne<{
          recipient_name: string;
          phone: string;
          line1: string;
          line2: string | null;
          city: string;
          state: string;
          postal_code: string;
          country: string;
          label: string | null;
        }>(
          `select recipient_name, phone, line1, line2, city, state, postal_code, country, label
           from addresses where id = $1`,
          [order.shipping_address_id]
        )
      : Promise.resolve(null),
    queryOne<{
      provider: string;
      provider_payment_id: string | null;
      amount: string;
      status: string;
    }>(
      `select provider, provider_payment_id, amount, status
       from payments where order_id = $1 order by created_at desc limit 1`,
      [id]
    )
  ]);

  // Fallback: default / latest customer address if order has none linked
  let address = shippingAddress;
  if (!address) {
    address = await queryOne(
      `select recipient_name, phone, line1, line2, city, state, postal_code, country, label
       from addresses
       where customer_id = $1
       order by is_default desc, id desc
       limit 1`,
      [order.customer_id]
    );
  }

  return ok({
    ...order,
    payment,
    shipping_address: address,
    items: items.map((item) => ({
      ...item,
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total)
    }))
  });
}
