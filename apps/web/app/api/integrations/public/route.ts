import { ok } from "../../../../lib/auth/api";
import { getPublicWhatsApp } from "../../../../lib/integrations";

/** Public, non-secret integration flags for storefront widgets. */
export async function GET() {
  try {
    const whatsapp = await getPublicWhatsApp();
    return ok({ whatsapp });
  } catch {
    return ok({
      whatsapp: {
        enabled: false,
        phoneNumber: null,
        showFloat: false,
        prefillMessage: null
      }
    });
  }
}
