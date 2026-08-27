import { NextRequest } from "next/server";
import { fail, getAuthContext, ok } from "../../../../lib/auth/api";
import {
  CART_HOLD_MINUTES,
  ensureCartReservationsSchema,
  getAvailableStock,
  listSessionReservations,
  releaseAllForSession,
  releaseExpiredReservations,
  setReservationQuantity,
  summarizeReservations
} from "../../../../lib/cart-reservations";

function readSessionKey(request: NextRequest, body?: { sessionKey?: string } | null) {
  const header = request.headers.get("x-cart-session") || "";
  const fromBody = body?.sessionKey || "";
  return String(fromBody || header || "").trim();
}

async function optionalCustomerId(request: NextRequest) {
  const ctx = await getAuthContext(request);
  return ctx?.userId || null;
}

export async function GET(request: NextRequest) {
  await ensureCartReservationsSchema();
  await releaseExpiredReservations();

  const sessionKey = readSessionKey(request);
  if (!sessionKey) return fail("sessionKey is required (header X-Cart-Session)");

  const productId = new URL(request.url).searchParams.get("productId");
  const variantId = new URL(request.url).searchParams.get("variantId");

  if (productId) {
    const available = await getAvailableStock(productId, variantId, sessionKey);
    return ok({ available, holdMinutes: CART_HOLD_MINUTES });
  }

  const rows = await listSessionReservations(sessionKey);
  return ok({
    holdMinutes: CART_HOLD_MINUTES,
    reservations: summarizeReservations(rows),
    rawCount: rows.length
  });
}

export async function POST(request: NextRequest) {
  await ensureCartReservationsSchema();

  const body = (await request.json().catch(() => null)) as {
    sessionKey?: string;
    productId?: string;
    variantId?: string | null;
    quantity?: number;
    delta?: number;
  } | null;

  const sessionKey = readSessionKey(request, body);
  if (!sessionKey) return fail("sessionKey is required");
  if (!body?.productId) return fail("productId is required");

  const customerId = await optionalCustomerId(request);

  try {
    let targetQty = body.quantity != null ? Math.trunc(Number(body.quantity)) : null;
    if (targetQty == null && body.delta != null) {
      const current = summarizeReservations(await listSessionReservations(sessionKey)).find(
        (row) =>
          row.productId === body.productId &&
          (row.variantId || null) === (body.variantId || null)
      );
      targetQty = (current?.quantity || 0) + Math.trunc(Number(body.delta));
    }
    if (targetQty == null) targetQty = 1;

    const result = await setReservationQuantity({
      sessionKey,
      customerId,
      productId: String(body.productId),
      variantId: body.variantId ?? null,
      quantity: Math.max(0, targetQty)
    });

    return ok({
      ...result,
      holdMinutes: CART_HOLD_MINUTES
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not reserve stock", 400);
  }
}

export async function DELETE(request: NextRequest) {
  await ensureCartReservationsSchema();

  const url = new URL(request.url);
  const sessionKey = readSessionKey(request) || String(url.searchParams.get("sessionKey") || "").trim();
  const productId = url.searchParams.get("productId");
  const variantId = url.searchParams.get("variantId");

  if (!sessionKey) return fail("sessionKey is required");

  try {
    if (!productId) {
      const released = await releaseAllForSession(sessionKey);
      return ok({ released });
    }
    const result = await setReservationQuantity({
      sessionKey,
      customerId: await optionalCustomerId(request),
      productId,
      variantId: variantId || null,
      quantity: 0
    });
    return ok(result);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not release reservation", 400);
  }
}
