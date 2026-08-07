import { cachedOk } from "../../../lib/auth/api";
import { getStorefrontBootstrap } from "../../../lib/catalog";

/** Public storefront bootstrap: settings + menus + active banners + home sections */
export async function GET() {
  const data = await getStorefrontBootstrap();
  return cachedOk(data);
}
