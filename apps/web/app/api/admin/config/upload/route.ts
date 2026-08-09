import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../../lib/auth/api";
import { saveUploadedImage, saveUploadedMedia } from "../../../../../lib/admin-upload";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm"
]);

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "cms:manage");
  if (error) return error;

  const form = await request.formData().catch(() => null);
  if (!form) return fail("Invalid form data");

  const kind = String(form.get("kind") || "image");
  const file = form.get("file");
  if (!(file instanceof File)) return fail("file is required");

  if (kind === "showcase") {
    const saved = await saveUploadedMedia({
      folder: "homepage/showcase",
      file,
      allowedTypes: MEDIA_TYPES
    });
    if ("error" in saved) return fail(saved.error, 400);
    return ok({ path: saved.path, mediaType: saved.mediaType });
  }

  const folder =
    kind === "hero" ? "homepage/hero" : kind === "status" ? "homepage/status" : "homepage/misc";

  const saved = await saveUploadedImage({
    folder,
    file,
    allowedTypes: IMAGE_TYPES
  });
  if ("error" in saved) return fail(saved.error, 400);
  return ok({ path: saved.path, mediaType: "image" as const });
}
