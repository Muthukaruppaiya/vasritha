import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission } from "../../../../../../lib/auth/api";
import { saveUploadedDocument } from "../../../../../../lib/admin-upload";

export async function POST(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "stock:operate",
    "purchases:operate",
    "stock:approve"
  ]);
  if (error) return error;

  const form = await request.formData().catch(() => null);
  if (!form) return fail("Expected multipart form data");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) {
    return fail("Choose a PDF or image of the supplier invoice");
  }

  const saved = await saveUploadedDocument({
    folder: "grn-invoices",
    file
  });
  if ("error" in saved) return fail(saved.error || "Upload failed", 400);
  return ok({ path: saved.path }, 201);
}
