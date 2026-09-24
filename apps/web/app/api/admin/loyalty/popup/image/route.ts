import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../../../lib/auth/api";
import { saveUploadedImage } from "../../../../../../lib/admin-upload";
import { ensureLoyaltyPopupSchema } from "../../../../../../lib/loyalty-popup";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "settings:business");
  if (error) return error;

  await ensureLoyaltyPopupSchema();
  const form = await request.formData().catch(() => null);
  if (!form) return fail("Invalid form data");

  const file = form.get("file");
  if (!(file instanceof File)) return fail("file is required");

  const saved = await saveUploadedImage({
    folder: "loyalty/popup",
    file,
    allowedTypes: IMAGE_TYPES
  });
  if ("error" in saved) return fail(saved.error || "Upload failed", 400);
  return ok({ path: saved.path });
}
