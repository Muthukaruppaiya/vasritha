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
  formatImportDbError,
  mapImportRows,
  parseImportFile,
  runProductImport,
  validateProductImportRows
} from "../../../../../lib/product-import";

export const runtime = "nodejs";

function fileError(message: string, status = 400) {
  return fail(message, status, {
    errors: [{ row: 1, name: "(file header)", error: message }]
  });
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;

  try {
    await ensureProductUnitsSchema();
    await ensureGstSchema();
    await ensureBrandsSchema();
    await ensureProductStatusEnum();
    await ensureProductRestockSchema();

    const form = await request.formData().catch(() => null);
    if (!form) return fileError("Upload a CSV or Excel (.xlsx / .xls) file");

    const file = form.get("file");
    if (!(file instanceof File)) return fileError("Upload a CSV or Excel (.xlsx / .xls) file");

    const mode = String(form.get("mode") || "import").toLowerCase();

    let rawRows: string[][];
    try {
      rawRows = await parseImportFile(file);
    } catch (err) {
      return fileError(err instanceof Error ? err.message : "Could not parse file");
    }

    let rows;
    try {
      rows = mapImportRows(rawRows);
    } catch (err) {
      return fileError(err instanceof Error ? err.message : "Invalid import file");
    }

    if (!rows.length) return fileError("No product rows found in the file");

    const validation = await validateProductImportRows(rows);
    if (mode === "validate" || mode === "check") {
      return ok({
        mode: "validate",
        ...validation
      });
    }

    if (!validation.ok) {
      return fail(
        `File has ${validation.errors.length} error(s). Fix the listed Excel rows and try again.`,
        400,
        {
          mode: "validate",
          ...validation
        }
      );
    }

    const result = await runProductImport({
      rows,
      actorUserId: ctx.userId,
      roles: (ctx.roles || []) as AppRole[]
    });

    if (result.rolledBack || (result.failed.length > 0 && result.created === 0 && result.updated === 0)) {
      const first = result.failed[0];
      const firstLabel = first?.row
        ? `Excel row ${first.row}: ${first.error}`
        : first?.error || "Import failed";
      return fail(`Import did not save any rows. ${firstLabel}`, 400, {
        mode: "import",
        rolledBack: true,
        errors: result.failed.map((item) => ({
          row: item.row || 0,
          name: item.name,
          error: item.error
        })),
        ...result
      });
    }

    return ok({ mode: "import", ...result });
  } catch (err) {
    const message = formatImportDbError(
      err instanceof Error ? err.message : "Import failed unexpectedly"
    );
    return fail(message, 400, {
      errors: [{ row: 0, name: "(file)", error: message }]
    });
  }
}
