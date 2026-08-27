import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission } from "../../../../../lib/auth/api";
import {
  ensureLoyaltySchema,
  evaluateLoyaltyForCustomer,
  resolveOrCreateCustomerByPhone
} from "../../../../../lib/loyalty";
import { normalizePosPhone, validatePosCustomer } from "../../../../../lib/pos";

/** POS / admin: preview loyalty prompts for a phone + cart total. */
export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "pos:create",
    "settings:business",
    "customers:search"
  ]);
  if (error) return error;

  await ensureLoyaltySchema();
  const { searchParams } = new URL(request.url);
  const phoneRaw = searchParams.get("phone") || "";
  const name = searchParams.get("name") || "Customer";
  const email = searchParams.get("email");
  const total = Number(searchParams.get("total") || 0);
  const phone = normalizePosPhone(phoneRaw);

  if (!phone || phone.length !== 10) {
    return ok(
      await evaluateLoyaltyForCustomer({
        customerId: null,
        channel: "pos",
        orderTotal: total
      })
    );
  }

  const validated = validatePosCustomer({ name, phone, email });
  if ("error" in validated) return fail(validated.error);

  const customerId = await resolveOrCreateCustomerByPhone(validated);
  const snapshot = await evaluateLoyaltyForCustomer({
    customerId,
    channel: "pos",
    orderTotal: total,
    phone: validated.phone,
    customerName: validated.name
  });
  return ok(snapshot);
}
