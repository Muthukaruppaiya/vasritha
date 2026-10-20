import { NextRequest } from "next/server";
import { fail, ok } from "../../../../lib/auth/api";
import {
  ensureCartReservationsSchema,
  releaseExpiredReservations
} from "../../../../lib/cart-reservations";

function authorizeCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.JWT_SECRET || "";
  const header = request.headers.get("x-cron-secret") || "";
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : header;
  if (!secret || token !== secret) return fail("Unauthorized", 401);
  return null;
}

/** Optional cron / keepalive: release expired bag holds back to stock. */
export async function POST(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  await ensureCartReservationsSchema();
  const released = await releaseExpiredReservations();
  return ok({ released, at: new Date().toISOString() });
}

export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  await ensureCartReservationsSchema();
  const released = await releaseExpiredReservations();
  return ok({ released, at: new Date().toISOString() });
}
