import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

export function barcodeDataUrl(value: string, height = 36, width = 1.4) {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, value, {
    format: "CODE128",
    width,
    height,
    displayValue: false,
    margin: 2,
    background: "#ffffff",
    lineColor: "#000000"
  });
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
