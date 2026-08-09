import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

export async function saveUploadedImage(input: {
  folder: string;
  file: File;
  allowedTypes: Set<string>;
  forceExt?: string;
}) {
  if (!input.allowedTypes.has(input.file.type)) {
    return { error: `Unsupported file type: ${input.file.type || "unknown"}` } as const;
  }
  if (input.file.size > MAX_IMAGE_BYTES) {
    return { error: "Image must be 4MB or smaller" } as const;
  }

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const ext =
    input.forceExt ||
    (input.file.type === "image/png"
      ? "png"
      : input.file.type === "image/webp"
        ? "webp"
        : input.file.type === "image/gif"
          ? "gif"
          : "jpg");

  const dir = path.join(process.cwd(), "public", "uploads", input.folder);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(path.join(dir, filename), bytes);
  return { path: `/uploads/${input.folder}/${filename}` } as const;
}

export async function saveUploadedMedia(input: {
  folder: string;
  file: File;
  allowedTypes: Set<string>;
}) {
  if (!input.allowedTypes.has(input.file.type)) {
    return { error: `Unsupported file type: ${input.file.type || "unknown"}` } as const;
  }
  const isVideo = input.file.type.startsWith("video/");
  const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (input.file.size > max) {
    return {
      error: isVideo ? "Video must be 40MB or smaller" : "Image must be 4MB or smaller"
    } as const;
  }

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const ext =
    input.file.type === "video/mp4" || input.file.type === "video/webm"
      ? input.file.type === "video/webm"
        ? "webm"
        : "mp4"
      : input.file.type === "image/png"
        ? "png"
        : input.file.type === "image/webp"
          ? "webp"
          : input.file.type === "image/gif"
            ? "gif"
            : "jpg";

  const dir = path.join(process.cwd(), "public", "uploads", input.folder);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(path.join(dir, filename), bytes);
  return {
    path: `/uploads/${input.folder}/${filename}`,
    mediaType: isVideo ? ("video" as const) : ("image" as const)
  } as const;
}
