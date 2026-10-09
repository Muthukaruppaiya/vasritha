import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { withTransaction } from "../../../../../lib/db/pool";
import { ensurePosSchema, validatePosCustomer } from "../../../../../lib/pos";
import {
  allocateSellableItems,
  createProductUnits,
  getShopVariantStock,
  markItemsSold,
  syncSellableStock
} from "../../../../../lib/product-units";
import type { QueryResultRow } from "pg";
import { query, queryOne } from "../../../../../lib/db/pool";
import {
  ensureGstSchema,
  getSellerGstProfile,
  resolveSaleGstRate,
  summariseInclusiveLines
} from "../../../../../lib/gst";
import { ensureShopsSchema, getShopById } from "../../../../../lib/shops";
import { ensureBrandsSchema, resolveBrandId } from "../../../../../lib/brands";
import {
  ensureLoyaltySchema,
  earnLoyaltyForPaidOrder,
  resolveOrCreateCustomerByPhone
} from "../../../../../lib/loyalty";
import { requireScopedShopId } from "../../../../../lib/shop-scope";
import { ensureExchangePolicySchema } from "../../../../../lib/exchange-policy";
import { nextDocumentNumber } from "../../../../../lib/document-numbers";

type CheckoutLine = {
  productId: string;
  variantId?: string | null;
  itemId?: string | null;
  quantity: number;
};

type ExchangeLine = {
  orderItemId: string;
  quantity: number;
};

type CheckoutBody = {
  items?: CheckoutLine[];
  discountType?: "percentage" | "fixed";
  discountValue?: number;
  paymentMethod?: "cash" | "razorpay" | "credit";
  /** Amount received now when paymentMethod is credit (0 … bill total). */
  amountPaid?: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  shopId?: string;
  /** In-store exchange against a prior paid POS invoice. */
  exchange?: {
    orderId: string;
    items: ExchangeLine[];
  } | null;
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
  orderId: string,
  shopId: string
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
           and shop_id = $3
           and status = 'to_sell'`,
        [item.item_id, item.variant_id, shopId]
      );
      if (!unit) {
        throw new Error("Scanned piece is not available for this store");
      }
      unitIds = [unit.id];
    } else {
      const tracked = await db.queryOne<{ c: number }>(
        `select count(*)::int as c from product_items
         where variant_id = $1 and shop_id = $2`,
        [item.variant_id, shopId]
      );
      const usesUniquePieces = Number(tracked?.c || 0) > 0;

      if (usesUniquePieces) {
        const allocated = await allocateSellableItems(
          db,
          item.variant_id,
          item.quantity,
          shopId
        );
        if (allocated.length < item.quantity) {
          throw new Error("Insufficient unique pieces for this store");
        }
        unitIds = allocated.map((row) => row.id);
      }
    }

    if (unitIds.length) {
      await markItemsSold(db, unitIds, orderId, item.variant_id);
      await syncSellableStock(db, item.variant_id, shopId);
      await db.query(
        `update products p
         set stock_quantity = coalesce((
           select sum(pv.stock_quantity)::int from product_variants pv where pv.product_id = p.id
         ), 0)
         where p.id = $1`,
        [item.product_id]
      );
    } else {
      const shopStock = await getShopVariantStock(db, item.variant_id, shopId);
      if (shopStock < item.quantity) {
        throw new Error("Insufficient stock for this store");
      }
      await db.query(
        `insert into shop_variant_stock (shop_id, variant_id, stock_quantity, updated_at)
         values ($1, $2, $3, now())
         on conflict (shop_id, variant_id) do update
           set stock_quantity = greatest(0, shop_variant_stock.stock_quantity - $4),
               updated_at = now()`,
        [shopId, item.variant_id, Math.max(0, shopStock - item.quantity), item.quantity]
      );
      await syncSellableStock(db, item.variant_id, shopId);
      await db.query(
        `update products p
         set stock_quantity = coalesce((
           select sum(pv.stock_quantity)::int from product_variants pv where pv.product_id = p.id
         ), 0)
         where p.id = $1`,
        [item.product_id]
      );
    }

    await db.query(
      `insert into inventory_movements
         (product_variant_id, type, quantity, reference_type, reference_id, created_by, shop_id)
       values ($1, 'sale', $2, 'order', $3, $4, $5)`,
      [item.variant_id, item.quantity, orderId, actorUserId, shopId]
    );
  }
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "pos:create");
  if (error || !ctx) return error;

  await ensurePosSchema();
  await ensureGstSchema();
  await ensureShopsSchema();
  await ensureBrandsSchema();
  await ensureLoyaltySchema();

  const body = (await request.json().catch(() => null)) as CheckoutBody | null;
  const items = body?.items || [];
  if (!items.length) return fail("Cart is empty — add the new exchange items");

  const exchangeReq =
    body?.exchange?.orderId && body.exchange.items?.length ? body.exchange : null;
  if (exchangeReq) await ensureExchangePolicySchema();

  let shopId: string;
  try {
    const scoped = await requireScopedShopId(
      ctx,
      body?.shopId ? String(body.shopId) : null
    );
    shopId = scoped.shopId;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No active shop configured");
  }

  const shop = await getShopById(shopId);
  const brandId = await resolveBrandId(shop?.brand_id || null);

  const customer = validatePosCustomer({
    name: body?.customerName,
    phone: body?.customerPhone,
    email: body?.customerEmail
  });
  if ("error" in customer) return fail(customer.error);

  const paymentMethod =
    body?.paymentMethod === "razorpay"
      ? "razorpay"
      : body?.paymentMethod === "credit"
        ? "credit"
        : "cash";
  const discountType = body?.discountType === "percentage" ? "percentage" : "fixed";
  const discountValue = Math.max(0, Number(body?.discountValue || 0));

  try {
    // Central customer by phone — always save into customer master for POS billing.
    let customerId: string;
    try {
      customerId = await resolveOrCreateCustomerByPhone(customer);
    } catch (err) {
      console.error("POS customer save failed:", err);
      throw err instanceof Error
        ? err
        : new Error("Could not save customer details for this bill");
    }

    const orderItems: Array<{
      product_id: string;
      variant_id: string | null;
      item_id: string | null;
      product_name: string;
      variant_name: string | null;
      sku: string | null;
      category_name: string | null;
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
        category_name: string | null;
      }>(
        `select p.id, p.name, p.price, p.stock_quantity, p.sku, p.status, p.hsn_code, p.gst_rate,
                coalesce(sc.name, c.name) as category_name
         from products p
         left join categories c on c.id = p.category_id
         left join subcategories sc on sc.id = p.subcategory_id
         where p.id = $1`,
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

      if (variantId) {
        const variant = await queryOne<{
          id: string;
          name: string;
          sku: string;
          price: string;
        }>(
          `select id, name, sku, price from product_variants where id = $1 and product_id = $2`,
          [variantId, product.id]
        );
        if (!variant) return fail(`Variant not found: ${variantId}`, 404);
        unitPrice = Number(variant.price);
        variantName = variant.name;
        sku = variant.sku;
        stock = await getShopVariantStock({ query, queryOne }, variant.id, shopId);
      } else {
        const firstVariant = await queryOne<{
          id: string;
          name: string;
          sku: string;
          price: string;
        }>(
          `select id, name, sku, price from product_variants where product_id = $1 order by name asc limit 1`,
          [product.id]
        );
        if (firstVariant) {
          variantId = firstVariant.id;
          unitPrice = Number(firstVariant.price);
          variantName = firstVariant.name;
          sku = firstVariant.sku;
          stock = await getShopVariantStock({ query, queryOne }, firstVariant.id, shopId);
        }
      }

      if (itemId && variantId) {
        const unit = await queryOne<{ id: string }>(
          `select id from product_items
           where id = $1 and variant_id = $2 and shop_id = $3 and status = 'to_sell'`,
          [itemId, variantId, shopId]
        );
        if (!unit) {
          return fail(`Scanned piece is not available for ${product.name} at this store`, 400);
        }
      }

      if (stock < quantity) {
        return fail(
          `Insufficient stock for ${product.name} at this store (available ${stock})`,
          400
        );
      }

      const lineTotal = unitPrice * quantity;
      const gstRate = resolveSaleGstRate({
        hsnCode,
        saleValuePerPiece: unitPrice,
        fallbackRate: product.gst_rate
      });
      subtotal += lineTotal;
      orderItems.push({
        product_id: product.id,
        variant_id: variantId,
        item_id: itemId,
        product_name: product.name,
        variant_name: variantName,
        sku,
        category_name: product.category_name ? String(product.category_name).trim() || null : null,
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

    // Validate exchange + compute return credit (no cash refund if credit > new total).
    let exchangeCredit = 0;
    let exchangeLines: Array<{
      orderItemId: string;
      quantity: number;
      unitPrice: number;
      productId: string | null;
      variantId: string | null;
      productName: string;
      sku: string | null;
    }> = [];

    if (exchangeReq) {
      const source = await queryOne<{
        id: string;
        order_number: string;
        payment_status: string;
        channel: string | null;
        shop_id: string | null;
        status: string;
      }>(
        `select id, order_number, payment_status, channel, shop_id, status::text as status
         from orders where id = $1`,
        [exchangeReq.orderId]
      );
      if (!source) return fail("Original invoice not found", 404);
      if (source.payment_status !== "paid") return fail("Original invoice is not paid", 400);
      if (source.channel !== "pos") return fail("Only store (POS) invoices can be exchanged here", 400);
      if (source.shop_id && source.shop_id !== shopId) {
        return fail("Invoice belongs to another shop", 400);
      }

      for (const row of exchangeReq.items) {
        const orderItemId = String(row.orderItemId || "").trim();
        const qty = Math.max(1, Math.floor(Number(row.quantity) || 0));
        if (!orderItemId) return fail("Exchange item id required", 400);
        const line = await queryOne<{
          id: string;
          order_id: string;
          product_id: string | null;
          variant_id: string | null;
          product_name: string;
          sku: string | null;
          unit_price: string | number;
          quantity: number;
        }>(
          `select id, order_id, product_id, variant_id, product_name, sku, unit_price, quantity
           from order_items where id = $1`,
          [orderItemId]
        );
        if (!line || line.order_id !== source.id) {
          return fail("Exchange item is not on the selected invoice", 400);
        }
        const already = await queryOne<{ returned: string }>(
          `select coalesce(sum(ri.quantity), 0)::text as returned
           from return_items ri
           join order_returns r on r.id = ri.return_id
           where ri.order_item_id = $1 and r.status <> 'rejected'`,
          [orderItemId]
        );
        const remaining = Number(line.quantity) - Number(already?.returned || 0);
        if (qty > remaining) {
          return fail(
            `Exchange qty exceeds remaining for ${line.product_name} (left ${remaining})`,
            400
          );
        }
        const unitPrice = Number(line.unit_price);
        exchangeCredit += unitPrice * qty;
        exchangeLines.push({
          orderItemId,
          quantity: qty,
          unitPrice,
          productId: line.product_id,
          variantId: line.variant_id,
          productName: line.product_name,
          sku: line.sku
        });
      }
      exchangeCredit = Math.round(exchangeCredit * 100) / 100;
    }

    // Fold exchange credit into discount for payable (capped at new-items subtotal).
    const cashierDiscount = discountAmount;
    const totalDiscount = Math.min(
      subtotal,
      Math.round((cashierDiscount + exchangeCredit) * 100) / 100
    );
    discountAmount = totalDiscount;

    const taxSummary = summariseInclusiveLines(
      orderItems.map((item) => ({ line_total: item.line_total, gst_rate: item.gst_rate })),
      discountAmount,
      false
    );
    const total = taxSummary.payable;

    const orderNumber = await nextDocumentNumber("invoice");
    // Cash = full pay now. Credit = partial/zero now, balance later. Razorpay = pending until verify.
    let amountPaid = total;
    if (paymentMethod === "credit") {
      const raw = Number(body?.amountPaid);
      if (!Number.isFinite(raw) || raw < 0) {
        return fail("Enter how much the customer is paying now (can be 0)", 400);
      }
      amountPaid = Math.round(Math.min(total, Math.max(0, raw)) * 100) / 100;
    } else if (paymentMethod === "razorpay") {
      amountPaid = 0;
    }
    const fullyPaid = amountPaid + 0.001 >= total;
    const settleNow = paymentMethod === "cash" || paymentMethod === "credit";
    const orderStatus = settleNow ? "confirmed" : "pending";
    const paymentStatus = settleNow && fullyPaid ? "paid" : "pending";
    const balanceDue = Math.round(Math.max(0, total - amountPaid) * 100) / 100;

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
        shop_id: string | null;
        pos_customer_name: string | null;
        pos_customer_phone: string | null;
        pos_customer_email: string | null;
      }>(
        `insert into orders (
           order_number, customer_id, shipping_address_id, status, payment_status,
           subtotal, discount_amount, tax_amount, shipping_amount, total_amount, channel,
           shop_id, brand_id, pos_customer_name, pos_customer_phone, pos_customer_email
         ) values ($1, $2, null, $3, $4, $5, $6, $7, 0, $8, 'pos', $9, $10, $11, $12, $13)
         returning id, order_number, created_at, total_amount, subtotal, discount_amount, tax_amount, payment_status, status, channel,
                   shop_id, brand_id, pos_customer_name, pos_customer_phone, pos_customer_email`,
        [
          orderNumber,
          customerId,
          orderStatus,
          paymentStatus,
          subtotal,
          discountAmount,
          taxSummary.gst,
          total,
          shopId,
          brandId,
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

      if (exchangeReq && exchangeLines.length) {
        const returnNumber = `EXC-${Date.now().toString().slice(-8)}`;
        const ret = await db.queryOne<{ id: string }>(
          `insert into order_returns (
             order_id, return_number, status, reason, request_type, refund_amount, admin_notes
           ) values ($1, $2, 'exchanged', $3, 'exchange', 0, $4)
           returning id`,
          [
            exchangeReq.orderId,
            returnNumber,
            `POS exchange → ${order.order_number}`,
            `Return credit ₹${exchangeCredit.toFixed(2)} · New bill ${order.order_number} · Collect ₹${total.toFixed(2)}`
          ]
        );
        if (!ret) throw new Error("Could not create exchange record");

        for (const line of exchangeLines) {
          await db.query(
            `insert into return_items (return_id, order_item_id, quantity, reason)
             values ($1, $2, $3, $4)`,
            [ret.id, line.orderItemId, line.quantity, "POS counter exchange"]
          );

          if (line.variantId && line.productId) {
            const tracked = await db.queryOne<{ c: number }>(
              `select count(*)::int as c from product_items
               where variant_id = $1 and shop_id = $2`,
              [line.variantId, shopId]
            );
            if (Number(tracked?.c || 0) > 0) {
              await createProductUnits(db, {
                productId: line.productId,
                variantId: line.variantId,
                tag: line.sku || "EXC",
                sku: line.sku || "EXC",
                count: line.quantity,
                shopId
              });
              await syncSellableStock(db, line.variantId, shopId);
            } else {
              await db.query(
                `insert into shop_variant_stock (shop_id, variant_id, stock_quantity, updated_at)
                 values ($1, $2, $3, now())
                 on conflict (shop_id, variant_id) do update
                   set stock_quantity = shop_variant_stock.stock_quantity + excluded.stock_quantity,
                       updated_at = now()`,
                [shopId, line.variantId, line.quantity]
              );
              await syncSellableStock(db, line.variantId, shopId);
            }
            await db.query(
              `insert into inventory_movements
                 (product_variant_id, type, quantity, reference_type, reference_id, note, created_by, shop_id)
               values ($1, 'return', $2, 'exchange', $3, $4, $5, $6)`,
              [
                line.variantId,
                line.quantity,
                ret.id,
                `POS exchange return · ${line.productName}`,
                ctx.userId,
                shopId
              ]
            ).catch(() => undefined);
          }
        }
      }

      if (settleNow && amountPaid > 0) {
        await db.query(
          `insert into payments (order_id, provider, provider_payment_id, amount, status)
           values ($1, $2, $3, $4, 'paid')`,
          [
            order.id,
            paymentMethod === "credit" ? "pos_credit" : "cash",
            `${paymentMethod}_${Date.now()}`,
            amountPaid
          ]
        );
      }

      if (settleNow) {
        await deductStock(
          db,
          orderItems.map((item) => ({
            variant_id: item.variant_id,
            product_id: item.product_id,
            quantity: item.quantity,
            item_id: item.item_id
          })),
          ctx.userId,
          order.id,
          shopId
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

    if (paymentMethod === "razorpay") {
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
        amountPaid,
        balanceDue,
        discountAmount,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerId
      }
    });

    let loyalty: Awaited<ReturnType<typeof earnLoyaltyForPaidOrder>> = null;
    if (paymentStatus === "paid") {
      loyalty = await earnLoyaltyForPaidOrder(checkoutResult.id);
    }

    try {
      const { syncOrderPaymentsIntoFinance } = await import("../../../../../lib/finance");
      await syncOrderPaymentsIntoFinance(20);
    } catch {
      /* finance sync is best-effort */
    }

    const seller = await getSellerGstProfile(shopId);
    const cashier = await queryOne<{ full_name: string | null; email: string | null }>(
      `select full_name, email from users where id = $1`,
      [ctx.userId]
    );
    const cashierName =
      (cashier?.full_name && String(cashier.full_name).trim()) ||
      (cashier?.email ? String(cashier.email).split("@")[0] : null) ||
      "Cashier";

    return ok(
      {
        order: {
          ...checkoutResult,
          customer_name: checkoutResult.pos_customer_name,
          customer_phone: checkoutResult.pos_customer_phone,
          customer_email: checkoutResult.pos_customer_email,
          cashier_name: cashierName,
          cashier_id: ctx.userId,
          loyalty_points_earned: loyalty?.points_earned ?? 0,
          loyalty_balance_after: loyalty?.balance_after ?? null,
          loyalty_prompt: loyalty?.prompt ?? null,
          tax_amount: taxSummary.gst,
          shop_id: shopId,
          amount_paid: amountPaid,
          balance_due: balanceDue,
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
        loyalty,
        seller,
        items: orderItems,
        paymentMethod,
        amountPaid,
        balanceDue,
        razorpay
      },
      201
    );
  } catch (err) {
    return fail(err instanceof Error ? err.message : "POS checkout failed", 400);
  }
}
