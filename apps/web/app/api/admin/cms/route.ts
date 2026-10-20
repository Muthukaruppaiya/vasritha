import { NextRequest } from "next/server";
import { ok, requirePermission } from "../../../../lib/auth/api";

/** @deprecated Use dedicated /api/admin/cms/* routes */
export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "cms:manage");
  if (error) return error;

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
