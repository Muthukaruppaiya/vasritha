/** Browser-side: shrink phone photos to JPEG so uploads succeed on mobile. */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const MAX_OUTPUT_BYTES = 3.5 * 1024 * 1024;

function loadImageElement(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "This phone photo format is not supported. Please choose a JPG/PNG photo, or set the camera to Most Compatible."
        )
      );
    };
    img.src = url;
  });
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", quality);
  });
  if (!blob) throw new Error("Could not prepare photo for upload");
  return blob;
}

/**
 * Convert any displayable image (incl. many phone camera captures) to a JPEG under ~3.5MB.
 */
export async function preparePhoneImageForUpload(file: File | Blob, nameHint = "photo.jpg") {
  const type = ("type" in file && file.type) || "";
  if (/heic|heif/i.test(type) || /\.heic$/i.test(nameHint)) {
    // Try decode anyway — some iOS versions already provide a decodable bitmap.
  }

  const img = await loadImageElement(file);
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

  let quality = JPEG_QUALITY;
  let blob = await canvasToJpegBlob(canvas, quality);
  while (blob.size > MAX_OUTPUT_BYTES && quality > 0.45) {
    quality -= 0.1;
    blob = await canvasToJpegBlob(canvas, quality);
  }

  if (blob.size > MAX_OUTPUT_BYTES) {
    throw new Error("Photo is still too large after compression. Try a different photo.");
  }

  const base = nameHint.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
