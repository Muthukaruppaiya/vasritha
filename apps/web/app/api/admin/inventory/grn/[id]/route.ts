import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission } from "../../../../../../lib/auth/api";
import { getGrnPrintDetail } from "../../../../../../lib/inventory-grn";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(request, [
    "stock:operate",
    "stock:approve",
    "purchases:operate"
  ]);
  if (error) return error;

  const { id } = await context.params;
  if (!id) return fail("GRN id required", 400);

  const data = await getGrnPrintDetail(id);
  if (!data) return fail("GRN not found", 404);
  return ok(data);
}
