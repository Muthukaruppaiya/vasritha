import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { withTransaction } from "../../../../../lib/db/pool";
import {
  ensurePosSchema,
  getWalkInCustomerId,
  validatePosCustomer
} from "../../../../../lib/pos";
import {
  allocateSellableItems,
  markItemsSold,
  syncSellableStock
} from "../../../../../lib/product-units";
import type { QueryResultRow } from "pg";
import { query, queryOne } from "../../../../../lib/db/pool";
import {
  ensureGstSchema,
  getSellerGstProfile,
  normalizeGstRate,
  summariseInclusiveLines
} from "../../../../../lib/gst";

type CheckoutLine = {
  productId: string;
  variantId?: string | null;
  itemId?: string | null;
  quantity: number;
};

type CheckoutBody = {
  items?: CheckoutLine[];
  discountType?: "percentage" | "fixed";
  discountValue?: number;
  paymentMethod?: "cash" | "razorpay";
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
};

type Db = {
  query: <R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<R[]>;
  queryOne: <R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<R | null>;
};

async function deductStock(
  db: Db,
  items: Array<{
    variant_id: string | null;
    product_id: string;
    quantity: number;
    item_id?: string | null;
  }>,
  actorUserId: string,
  orderId: string
) {
  for (const item of items) {
    if (!item.variant_id) {
      throw new Error("Line item is missing a product variant");
    }

    let unitIds: string[] = [];

    if (item.item_id) {
      const unit = await db.queryOne<{ id: string }>(
        `select id from product_items
         where id = $1
           and variant_id = $2
           and status = 'to_sell'`,
        [item.item_id, item.variant_id]
      );
      if (!unit) {
        throw new Error("Scanned piece is not available for this product");
      }
      unitIds = [unit.id];
    } else {
      const tracked = await db.queryOne<{ c: number }>(
        `select count(*)::int as c from product_items where variant_id = $1`,
        [item.variant_id]
      );
      const usesUniquePieces = Number(tracked?.c || 0) > 0;

      if (usesUniquePieces) {
        const allocated = await allocateSellableItems(db, item.variant_id, item.quantity);
        if (allocated.length < item.quantity) {
          throw new Error("Insufficient unique pieces for a line item");
        }
        unitIds = allocated.map((row) => row.id);
      }
    }

    if (unitIds.length) {
      await markItemsSold(db, unitIds, orderId, item.variant_id);
      await syncSellableStock(db, item.variant_id);
      await db.query(
        `update products p
         set stock_quantity = coalesce((
           select sum(pv.stock_quantity)::int from product_variants pv where pv.product_id = p.id
         ), 0)
         where p.id = $1`,
        [item.product_id]
      );
    } else {
      // Catalogue/seed stock without unique barcodes — reduce quantity only.
      const updated = await db.queryOne<{ id: string }>(
        `update product_variants
         set stock_quantity = stock_quantity - $2
         where id = $1 and stock_quantity >= $2
         returning id`,
        [item.variant_id, item.quantity]
      );
      if (!updated) {
        throw new Error("Insufficient stock for a line item");
      }
      await db.query(
        `update products
         set stock_quantity = greatest(0, stock_quantity - $2)
         where id = $1`,
        [item.product_id, item.quantity]
      );
    }

    await db.query(
      `insert into inventory_movements (product_variant_id, type, quantity, reference_type, reference_id, created_by)
       values ($1, 'sale', $2, 'order', $3, $4)`,
      [item.variant_id, item.quantity, orderId, actorUserId]
    );
  }
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "pos:create");
  if (error || !ctx) return error;

  await ensurePosSchema();
  await ensureGstSchema();

  const body = (await request.json().catch(() => null)) as CheckoutBody | null;
  const items = body?.items || [];
  if (!items.length) return fail("Cart is empty");

  const customer = validatePosCustomer({
    name: body?.customerName,
    phone: body?.customerPhone,
    email: body?.customerEmail
  });
  if ("error" in customer) return fail(customer.error);

  const paymentMethod = body?.paymentMethod === "razorpay" ? "razorpay" : "cash";
  const discountType = body?.discountType === "percentage" ? "percentage" : "fixed";
  const discountValue = Math.max(0, Number(body?.discountValue || 0));

  try {
    const walkInId = await getWalkInCustomerId();

    const orderItems: Array<{
      product_id: string;
      variant_id: string | null;
      item_id: string | null;
      product_name: string;
      variant_name: string | null;
      sku: string | null;
      hsn_code: string | null;
      gst_rate: number;
      unit_price: number;
      quantity: number;
      line_total: number;
    }> = [];

    let subtotal = 0;

    for (const line of items) {
      const quantity = Math.max(1, Math.floor(Number(line.quantity) || 1));
      const itemId = line.itemId ? String(line.itemId) : null;
      const product = await queryOne<{
        id: string;
        name: string;
        price: string;
        stock_quantity: number;
        sku: string | null;
        status: string;
        hsn_code: string | null;
        gst_rate: string | number | null;
      }>(
        `select id, name, price, stock_quantity, sku, status, hsn_code, gst_rate
         from products where id = $1`,
        [line.productId]
      );
      if (!product || product.status !== "active") {
        return fail(`Product unavailable: ${line.productId}`, 404);
      }

      let unitPrice = Number(product.price);
      let variantName: string | null = null;
      let sku = product.sku;
      let variantId: string | null = line.variantId || null;
      let stock = Number(product.stock_quantity);
      const hsnCode = product.hsn_code ? String(product.hsn_code).trim() || null : null;
      const gstRate = normalizeGstRate(product.gst_rate, 5);

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

      if (itemId && variantId) {
        const unit = await queryOne<{ id: string }>(
          `select id from product_items
           where id = $1 and variant_id = $2 and status = 'to_sell'`,
          [itemId, variantId]
        );
        if (!unit) {
          return fail(`Scanned piece is not available for ${product.name}`, 400);
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
        item_id: itemId,
        product_name: product.name,
        variant_name: variantName,
        sku,
        hsn_code: hsnCode,
        gst_rate: gstRate,
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
    const taxSummary = summariseInclusiveLines(
      orderItems.map((item) => ({ line_total: item.line_total, gst_rate: item.gst_rate })),
      discountAmount,
      false
    );
    const total = taxSummary.payable;

    const orderNumber = `POS-${Date.now().toString().slice(-8)}`;
    const paid = paymentMethod === "cash";

    const checkoutResult = await withTransaction(async (db) => {
      const order = await db.queryOne<{
        id: string;
        order_number: string;
        created_at: string;
        total_amount: string;
        subtotal: string;
        discount_amount: string;
        tax_amount: string;
        payment_status: string;
        status: string;
        channel: string;
        pos_customer_name: string | null;
        pos_customer_phone: string | null;
        pos_customer_email: string | null;
      }>(
        `insert into orders (
           order_number, customer_id, shipping_address_id, status, payment_status,
           subtotal, discount_amount, tax_amount, shipping_amount, total_amount, channel,
           pos_customer_name, pos_customer_phone, pos_customer_email
         ) values ($1, $2, null, $3, $4, $5, $6, $7, 0, $8, 'pos', $9, $10, $11)
         returning id, order_number, created_at, total_amount, subtotal, discount_amount, tax_amount, payment_status, status, channel,
                   pos_customer_name, pos_customer_phone, pos_customer_email`,
        [
          orderNumber,
          walkInId,
          paid ? "confirmed" : "pending",
          paid ? "paid" : "pending",
          subtotal,
          discountAmount,
          taxSummary.gst,
          total,
          customer.name,
          customer.phone,
          customer.email
        ]
      );

      if (!order) throw new Error("Could not create POS order");

      for (const item of orderItems) {
        await db.query(
          `insert into order_items (
             order_id, product_id, variant_id, product_name, variant_name, sku,
             hsn_code, gst_rate, unit_price, quantity, line_total
           ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            order.id,
            item.product_id,
            item.variant_id,
            item.product_name,
            item.variant_name,
            item.sku,
            item.hsn_code,
            item.gst_rate,
            item.unit_price,
            item.quantity,
            item.line_total
          ]
        );
      }

      if (paid) {
        await db.query(
          `insert into payments (order_id, provider, provider_payment_id, amount, status)
           values ($1, 'cash', $2, $3, 'paid')`,
          [order.id, `cash_${Date.now()}`, total]
        );
        await deductStock(
          db,
          orderItems.map((item) => ({
            variant_id: item.variant_id,
            product_id: item.product_id,
            quantity: item.quantity,
            item_id: item.item_id
          })),
          ctx.userId,
          order.id
        );
      }

      return order;
    });

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
          [checkoutResult.id, total]
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
            receipt: checkoutResult.order_number,
            notes: { order_id: checkoutResult.id, channel: "pos" }
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
          [checkoutResult.id, total]
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
      entityId: checkoutResult.id,
      after: {
        paymentMethod,
        total,
        discountAmount,
        customerName: customer.name,
        customerPhone: customer.phone
      }
    });

    const seller = await getSellerGstProfile();

    return ok(
      {
        order: {
          ...checkoutResult,
          customer_name: checkoutResult.pos_customer_name,
          customer_phone: checkoutResult.pos_customer_phone,
          customer_email: checkoutResult.pos_customer_email,
          tax_amount: taxSummary.gst,
          gst: {
            taxable: taxSummary.taxable,
            cgst: taxSummary.cgst,
            sgst: taxSummary.sgst,
            igst: taxSummary.igst,
            inclusive: true
          },
          seller,
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
