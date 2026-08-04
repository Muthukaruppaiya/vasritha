import { ok } from "../../../../lib/auth/api";

/** @deprecated Use dedicated /api/admin/cms/* routes */
export async function GET() {
  return ok({
    routes: [
      "/api/admin/cms/menus",
      "/api/admin/cms/banners",
      "/api/admin/cms/pages",
      "/api/admin/cms/sections",
      "/api/admin/settings"
    ]
  });
}
