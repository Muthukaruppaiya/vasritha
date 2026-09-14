/** Browser-side: shrink phone photos to JPEG so uploads succeed on mobile. */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const MAX_OUTPUT_BYTES = 3.5 * 1024 * 1024;
const MAX_FALLBACK_BYTES = 7.5 * 1024 * 1024;

function toFile(blob: Blob, name: string, type: string) {
  try {
    return new File([blob], name, { type, lastModified: Date.now() });
  } catch {
    const fallback = blob as Blob & { name?: string };
    Object.defineProperty(fallback, "name", { value: name, configurable: true });
    return fallback as File;
  }
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  if (canvas.toBlob) {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", quality);
    });
    if (blob) return blob;
  }
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const res = await fetch(dataUrl);
  return res.blob();
}

async function drawFileToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  // Prefer createImageBitmap when available (more reliable on modern mobile browsers).
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not prepare photo for upload");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();
      return canvas;
    } catch {
      // fall through to <img>
    }
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not open that photo on this phone."));
    };
    image.src = url;
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare photo for upload");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

/**
 * Convert any displayable image to a JPEG under ~3.5MB.
 * Falls back to the original file when compression is not possible.
 */
export async function preparePhoneImageForUpload(file: File | Blob, nameHint = "photo.jpg") {
  const originalName =
    ("name" in file && typeof file.name === "string" && file.name) || nameHint || "photo.jpg";
  const originalType = ("type" in file && file.type) || "";

  try {
    const canvas = await drawFileToCanvas(file);
    let quality = JPEG_QUALITY;
    let blob = await canvasToJpegBlob(canvas, quality);
    while (blob.size > MAX_OUTPUT_BYTES && quality > 0.45) {
      quality -= 0.1;
      blob = await canvasToJpegBlob(canvas, quality);
    }
    if (blob.size <= MAX_OUTPUT_BYTES) {
      const base = originalName.replace(/\.[^.]+$/, "") || "photo";
      return toFile(blob, `${base}.jpg`, "image/jpeg");
    }
  } catch {
    // Fall through to original when possible.
  }

  if (file.size <= MAX_FALLBACK_BYTES) {
    const type = originalType || "image/jpeg";
    if (/heic|heif/i.test(type) || /\.heic$/i.test(originalName)) {
      throw new Error(
        "This HEIC photo could not be converted. On iPhone: Settings → Camera → Formats → Most Compatible, then retake."
      );
    }
    return toFile(file, originalName.replace(/\.[^.]+$/, "") + ".jpg", type.startsWith("image/") ? type : "image/jpeg");
  }

  throw new Error("Photo is too large. Try taking again at a lower resolution.");
}
