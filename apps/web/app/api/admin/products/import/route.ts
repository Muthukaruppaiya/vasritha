import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../../lib/auth/api";
import type { AppRole } from "../../../../../lib/auth/rbac";
import {
  ensureBrandsSchema
} from "../../../../../lib/brands";
import { ensureGstSchema } from "../../../../../lib/gst";
import { ensureProductRestockSchema } from "../../../../../lib/order-courier";
import {
  ensureProductStatusEnum
} from "../../../../../lib/product-status";
import { ensureProductUnitsSchema } from "../../../../../lib/product-units";
import {
  mapImportRows,
  parseImportFile,
  runProductImport
} from "../../../../../lib/product-import";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;

  await ensureProductUnitsSchema();
  await ensureGstSchema();
  await ensureBrandsSchema();
  await ensureProductStatusEnum();
  await ensureProductRestockSchema();

  const form = await request.formData().catch(() => null);
  if (!form) return fail("Upload a CSV or Excel (.xlsx / .xls) file");

  const file = form.get("file");
  if (!(file instanceof File)) return fail("Upload a CSV or Excel (.xlsx / .xls) file");

  let rawRows: string[][];
  try {
    rawRows = await parseImportFile(file);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not parse file");
  }

  let rows;
  try {
    rows = mapImportRows(rawRows);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Invalid import file");
  }

  if (!rows.length) return fail("No product rows found in the file");

  const result = await runProductImport({
    rows,
    actorUserId: ctx.userId,
    roles: (ctx.roles || []) as AppRole[]
  });

  return ok(result);
}
