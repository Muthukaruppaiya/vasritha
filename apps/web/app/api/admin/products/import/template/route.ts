import { NextRequest } from "next/server";
import { fail, requirePermission } from "../../../../../../lib/auth/api";
import { buildProductImportTemplate } from "../../../../../../lib/product-import";
import { attachmentHeaders } from "../../../../../../lib/export-table";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "products:manage");
  if (error) return error;

  try {
    const buffer = await buildProductImportTemplate();
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: attachmentHeaders(
        `vasritha-product-import-template.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not build template", 500);
  }
}
