import { ok } from "../../../../lib/auth/api";
import { getLoyaltyPopupPublic } from "../../../../lib/loyalty-popup";

export const dynamic = "force-dynamic";

/** Public loyalty popup config for the storefront (no auth). */
export async function GET() {
  const data = await getLoyaltyPopupPublic();
  return ok(data);
}
