import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../lib/auth/api";
import { computeCouponDiscount } from "../../../../lib/coupon-discount";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: string;
  tax_amount: string;
  shipping_amount: string;
  total_amount: string;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "orders:own");
  if (error || !ctx) return error;

  const orders = await query<OrderRow>(
    `select id, order_number, status, payment_status, subtotal, tax_amount, shipping_amount, total_amount, created_at
     from orders
     where customer_id = $1
     order by created_at desc`,
    [ctx.userId]
  );

  const orderIds = orders.map((o) => o.id);
  const items = orderIds.length
    ? await query(`select * from order_items where order_id = any($1::uuid[])`, [orderIds])
    : [];

  const data = orders.map((order) => ({
    ...order,
    order_items: items.filter((item) => (item as { order_id: string }).order_id === order.id)
  }));

  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "checkout:own");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    shippingAddressId?: string;
    couponCode?: string;
    items?: Array<{ productId: string; variantId?: string; quantity: number }>;
  } | null;

  if (!body?.shippingAddressId) return fail("shippingAddressId is required");

  let lines = body.items ?? [];

  if (!lines.length) {
    const cart = await queryOne<{ id: string }>(`select id from carts where customer_id = $1`, [ctx.userId]);
    if (cart) {
      const cartItems = await query<{ product_id: string; variant_id: string | null; quantity: number }>(
        `select product_id, variant_id, quantity from cart_items where cart_id = $1`,
        [cart.id]
      );
      lines = cartItems.map((item) => ({
        productId: item.product_id,
        variantId: item.variant_id ?? undefined,
        quantity: item.quantity
      }));
    }
  }

  if (!lines.length) return fail("Cart is empty");

  const address = await queryOne(
    `select * from addresses where id = $1 and customer_id = $2`,
    [body.shippingAddressId, ctx.userId]
  );

  if (!address) return fail("Address not found", 404);

  const orderItems: Array<{
    product_id: string;
    variant_id: string | null;
    product_name: string;
    variant_name: string | null;
    sku: string | null;
    unit_price: number;
    quantity: number;
    line_total: number;
  }> = [];

  let subtotal = 0;

  for (const line of lines) {
    const product = await queryOne<{ id: string; name: string; price: string }>(
      `select id, name, price from products where id = $1`,
      [line.productId]
    );
    if (!product) return fail(`Product not found: ${line.productId}`, 404);

    let unitPrice = Number(product.price);
    let variantName: string | null = null;
    let sku: string | null = null;

    if (line.variantId) {
      const variant = await queryOne<{ id: string; name: string; sku: string; price: string }>(
        `select id, name, sku, price from product_variants where id = $1`,
        [line.variantId]
      );
      if (!variant) return fail(`Variant not found: ${line.variantId}`, 404);
      unitPrice = Number(variant.price);
      variantName = variant.name;
      sku = variant.sku;
    }

    const quantity = Math.max(1, Number(line.quantity));
    const lineTotal = unitPrice * quantity;
    subtotal += lineTotal;

    orderItems.push({
      product_id: product.id,
      variant_id: line.variantId ?? null,
      product_name: product.name,
      variant_name: variantName,
      sku,
      unit_price: unitPrice,
      quantity,
      line_total: lineTotal
    });
  }

  const couponCode = body.couponCode ? String(body.couponCode).trim().toUpperCase() : "";
  let discountAmount = 0;
  let couponId: string | null = null;

  if (couponCode) {
    const coupon = await queryOne<{
      id: string;
      discount_type: string;
      discount_value: string;
      min_order_amount: string;
      max_discount_amount: string | null;
      starts_at: string | null;
      ends_at: string | null;
    }>(
      `select id, discount_type, discount_value, min_order_amount, max_discount_amount, starts_at, ends_at
       from coupons
       where code = $1 and status = 'active'`,
      [couponCode]
    );
    if (!coupon) return fail("Invalid voucher code");
    const now = Date.now();
    if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) return fail("Voucher not started");
    if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now) return fail("Voucher expired");
    const computed = computeCouponDiscount({
      discountType: coupon.discount_type,
      discountValue: Number(coupon.discount_value),
      minOrderAmount: Number(coupon.min_order_amount),
      maxDiscountAmount: coupon.max_discount_amount != null ? Number(coupon.max_discount_amount) : null,
      subtotal
    });
    if (!computed.ok) return fail(computed.error);
    discountAmount = computed.discount;
    couponId = coupon.id;
  }

  const total = Math.max(0, subtotal - discountAmount);

  const orderNumber = `VAS-${Date.now().toString().slice(-8)}`;
  const order = await queryOne<{ id: string; order_number: string; created_at: string; total_amount: string }>(
    `insert into orders (order_number, customer_id, shipping_address_id, status, payment_status, subtotal, discount_amount, tax_amount, shipping_amount, total_amount)
     values ($1, $2, $3, 'pending', 'pending', $4, $5, 0, 0, $6)
     returning id, order_number, created_at, total_amount`,
    [orderNumber, ctx.userId, (address as { id: string }).id, subtotal, discountAmount, total]
  );

  if (!order) return fail("Order create failed", 400);

  if (couponId && discountAmount > 0) {
    await query(
      `insert into coupon_usage (coupon_id, customer_id, order_id, discount_amount)
       values ($1, $2, $3, $4)`,
      [couponId, ctx.userId, order.id, discountAmount]
    );
  }

  for (const item of orderItems) {
    await query(
      `insert into order_items (order_id, product_id, variant_id, product_name, variant_name, sku, unit_price, quantity, line_total)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        order.id,
        item.product_id,
        item.variant_id,
        item.product_name,
        item.variant_name,
        item.sku,
        item.unit_price,
        item.quantity,
        item.line_total
      ]
    );
  }

  const cart = await queryOne<{ id: string }>(`select id from carts where customer_id = $1`, [ctx.userId]);
  if (cart) await query(`delete from cart_items where cart_id = $1`, [cart.id]);

  return ok({ order, items: orderItems }, 201);
}
