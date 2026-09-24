import { ok } from "../../../../lib/auth/api";
import {
  buildPurchasePolicySummary,
  getExchangePolicySettings
} from "../../../../lib/exchange-policy";

export const dynamic = "force-dynamic";

/** Public purchase / exchange policy snapshot from site_settings (no fake values). */
export async function GET() {
  const settings = await getExchangePolicySettings();
  return ok({
    ...settings,
    summary: buildPurchasePolicySummary(settings)
  });
}
