import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

/**
 * Thermal-friendly CODE128. Uses thicker modules + scale so bars stay sharp
 * when shrunk onto 35×22 / 50×25 mm labels.
 */
export function barcodeDataUrl(
  value: string,
  height = 48,
  width = 2,
  opts?: { scale?: number; margin?: number }
) {
  const canvas = document.createElement("canvas");
  const scale = Math.max(2, Math.min(4, opts?.scale ?? 3));
  const margin = opts?.margin ?? 1;
  // Longer piece codes need slightly narrower modules so bars don't crush when scaled.
  const len = String(value || "").length;
  const module = len > 18 ? Math.max(1.6, width * 0.85) : Math.max(1.8, width);

  JsBarcode(canvas, value, {
    format: "CODE128",
    width: module,
    height: Math.max(32, height),
    displayValue: false,
    margin,
    background: "#ffffff",
    lineColor: "#000000"
  });

  // Upscale for print crispness (nearest-neighbor feel via high-res PNG).
  if (scale > 1) {
    const hi = document.createElement("canvas");
    hi.width = canvas.width * scale;
    hi.height = canvas.height * scale;
    const ctx = hi.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, hi.width, hi.height);
      ctx.drawImage(canvas, 0, 0, hi.width, hi.height);
      return hi.toDataURL("image/png");
    }
  }

  return canvas.toDataURL("image/png");
}

export async function qrDataUrl(value: string, size = 72) {
  return QRCode.toDataURL(value, {
    width: size,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" }
  });
}

export function escapePrintHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
