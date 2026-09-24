import { ok } from "../../../../lib/auth/api";
import { getShippingSettings } from "../../../../lib/shipping";

export const dynamic = "force-dynamic";

/** Public shipping policy snapshot from site_settings (no fake values). */
export async function GET() {
  const settings = await getShippingSettings();
  return ok({
    delivery_enabled: settings.delivery_enabled,
    free_shipping_min: settings.free_shipping_min,
    default_shipping_fee: settings.default_shipping_fee,
    estimated_delivery_text: settings.estimated_delivery_text,
    order_processing_text: settings.order_processing_text,
    shipping_policy_notes: settings.shipping_policy_notes,
    delivery_pincode_mode: settings.delivery_pincode_mode,
    delivery_pincodes: settings.delivery_pincodes
  });
}
