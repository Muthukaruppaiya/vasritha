import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";
import { ensurePosSchema, getWalkInCustomerId } from "../../../../../lib/pos";

type CheckoutLine = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

type CheckoutBody = {
  items?: CheckoutLine[];
  discountType?: "percentage" | "fixed";
  discountValue?: number;
  paymentMethod?: "cash" | "razorpay";
};

async function deductStock(
  items: Array<{ variant_id: string | null; product_id: string; quantity: number }>,
  actorUserId: string,
  orderId: string
) {
  for (const item of items) {
    if (item.variant_id) {
      const variant = await queryOne<{ stock_quantity: number }>(
        `select stock_quantity from product_variants where id = $1`,
        [item.variant_id]
      );
      if (!variant || Number(variant.stock_quantity) < item.quantity) {
        throw new Error("Insufficient stock for a line item");
      }
      await query(`update product_variants set stock_quantity = stock_quantity - $2 where id = $1`, [
        item.variant_id,
        item.quantity
      ]);
      await query(
        `insert into inventory_movements (product_variant_id, type, quantity, reference_type, reference_id, created_by)
         values ($1, 'sale', $2, 'order', $3, $4)`,
        [item.variant_id, item.quantity, orderId, actorUserId]
      );
    }

    await query(
      `update products set stock_quantity = greatest(0, stock_quantity - $2) where id = $1`,
      [item.product_id, item.quantity]
    );
  }
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "pos:create");
  if (error || !ctx) return error;

  await ensurePosSchema();

  const body = (await request.json().catch(() => null)) as CheckoutBody | null;
  const items = body?.items || [];
  if (!items.length) return fail("Cart is empty");

  const paymentMethod = body?.paymentMethod === "razorpay" ? "razorpay" : "cash";
  const discountType = body?.discountType === "percentage" ? "percentage" : "fixed";
  const discountValue = Math.max(0, Number(body?.discountValue || 0));

  try {
    const walkInId = await getWalkInCustomerId();

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

    for (const line of items) {
      const quantity = Math.max(1, Math.floor(Number(line.quantity) || 1));
      const product = await queryOne<{
        id: string;
        name: string;
        price: string;
        stock_quantity: number;
        sku: string | null;
        status: string;
      }>(`select id, name, price, stock_quantity, sku, status from products where id = $1`, [
        line.productId
      ]);
      if (!product || product.status !== "active") {
        return fail(`Product unavailable: ${line.productId}`, 404);
      }

      let unitPrice = Number(product.price);
      let variantName: string | null = null;
      let sku = product.sku;
      let variantId: string | null = line.variantId || null;
      let stock = Number(product.stock_quantity);

      if (variantId) {
        const variant = await queryOne<{
          id: string;
          name: string;
          sku: string;
          price: string;
          stock_quantity: number;
        }>(
          `select id, name, sku, price, stock_quantity from product_variants where id = $1 and product_id = $2`,
          [variantId, product.id]
        );
        if (!variant) return fail(`Variant not found: ${variantId}`, 404);
        unitPrice = Number(variant.price);
        variantName = variant.name;
        sku = variant.sku;
        stock = Number(variant.stock_quantity);
      } else {
        const firstVariant = await queryOne<{
          id: string;
          name: string;
          sku: string;
          price: string;
          stock_quantity: number;
        }>(
          `select id, name, sku, price, stock_quantity from product_variants where product_id = $1 order by name asc limit 1`,
          [product.id]
        );
        if (firstVariant) {
          variantId = firstVariant.id;
          unitPrice = Number(firstVariant.price);
          variantName = firstVariant.name;
          sku = firstVariant.sku;
          stock = Number(firstVariant.stock_quantity);
        }
      }

      if (stock < quantity) {
        return fail(`Insufficient stock for ${product.name} (available ${stock})`, 400);
      }

      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;
      orderItems.push({
        product_id: product.id,
        variant_id: variantId,
        product_name: product.name,
        variant_name: variantName,
        sku,
        unit_price: unitPrice,
        quantity,
        line_total: lineTotal
      });
    }

    let discountAmount = 0;
    if (discountValue > 0) {
      discountAmount =
        discountType === "percentage"
          ? Math.min(subtotal, (subtotal * discountValue) / 100)
          : Math.min(subtotal, discountValue);
    }
    discountAmount = Math.round(discountAmount * 100) / 100;
    const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    const orderNumber = `POS-${Date.now().toString().slice(-8)}`;
    const paid = paymentMethod === "cash";

    const order = await queryOne<{
      id: string;
      order_number: string;
      created_at: string;
      total_amount: string;
      subtotal: string;
      discount_amount: string;
      payment_status: string;
      status: string;
      channel: string;
    }>(
      `insert into orders (
         order_number, customer_id, shipping_address_id, status, payment_status,
         subtotal, discount_amount, tax_amount, shipping_amount, total_amount, channel
       ) values ($1, $2, null, $3, $4, $5, $6, 0, 0, $7, 'pos')
       returning id, order_number, created_at, total_amount, subtotal, discount_amount, payment_status, status, channel`,
      [
        orderNumber,
        walkInId,
        paid ? "confirmed" : "pending",
        paid ? "paid" : "pending",
        subtotal,
        discountAmount,
        total
      ]
    );

    if (!order) return fail("Could not create POS order", 400);

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

    if (paid) {
      await query(
        `insert into payments (order_id, provider, provider_payment_id, amount, status)
         values ($1, 'cash', $2, $3, 'paid')`,
        [order.id, `cash_${Date.now()}`, total]
      );
      await deductStock(
        orderItems.map((item) => ({
          variant_id: item.variant_id,
          product_id: item.product_id,
          quantity: item.quantity
        })),
        ctx.userId,
        order.id
      );
    }

    let razorpay: {
      mode: string;
      paymentId: string;
      razorpayOrderId: string;
      keyId: string | null;
      amount: string;
      currency: string;
    } | null = null;

    if (!paid) {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!keyId || !keySecret) {
        const payment = await queryOne<{ id: string }>(
          `insert into payments (order_id, provider, provider_payment_id, amount, status)
           values ($1, 'razorpay_test', null, $2, 'pending')
           returning id`,
          [order.id, total]
        );
        if (!payment) return fail("Payment create failed", 400);
        razorpay = {
          mode: "test",
          paymentId: payment.id,
          razorpayOrderId: `order_test_${Date.now()}`,
          keyId: null,
          amount: String(total),
          currency: "INR"
        };
      } else {
        const amountPaise = Math.round(total * 100);
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
        const razorpayRes = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            amount: amountPaise,
            currency: "INR",
            receipt: order.order_number,
            notes: { order_id: order.id, channel: "pos" }
          })
        });
        const razorpayOrder = (await razorpayRes.json()) as {
          id?: string;
          error?: { description?: string };
        };
        if (!razorpayRes.ok || !razorpayOrder.id) {
          return fail(razorpayOrder.error?.description ?? "Razorpay order create failed", 502);
        }
        const payment = await queryOne<{ id: string }>(
          `insert into payments (order_id, provider, provider_payment_id, amount, status)
           values ($1, 'razorpay', null, $2, 'pending')
           returning id`,
          [order.id, total]
        );
        if (!payment) return fail("Payment create failed", 400);
        razorpay = {
          mode: "live",
          paymentId: payment.id,
          razorpayOrderId: razorpayOrder.id,
          keyId,
          amount: String(total),
          currency: "INR"
        };
      }
    }

    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "pos_checkout",
      entityType: "orders",
      entityId: order.id,
      after: { paymentMethod, total, discountAmount }
    });

    return ok(
      {
        order: {
          ...order,
          items: orderItems
        },
        paymentMethod,
        razorpay
      },
      201
    );
  } catch (err) {
    return fail(err instanceof Error ? err.message : "POS checkout failed", 400);
  }
}
