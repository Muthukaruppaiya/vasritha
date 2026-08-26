import JsBarcode from "jsbarcode";

export type StickerItem = {
  id?: string;
  unit_code: string;
  barcode: string;
  tag?: string;
  price?: number | string;
  labelSize?: "accessory" | "dress";
};

function barcodePng(value: string, height: number) {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, value, {
    format: "CODE128",
    width: 1.6,
    height,
    displayValue: false,
    margin: 2,
    background: "#ffffff",
    lineColor: "#000000"
  });
  return canvas.toDataURL("image/png");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPrice(value: number | string) {
  return `₹ ${Number(value || 0).toLocaleString("en-IN")}/-`;
}

function stickerHtml(input: {
  brand: string;
  price: string;
  sizeClass: "accessory" | "dress";
  item: StickerItem;
}) {
  const src = barcodePng(input.item.barcode, input.sizeClass === "accessory" ? 28 : 42);
  return `<article class="sticker ${input.sizeClass}">
    <div class="brand">${escapeHtml(input.brand)}</div>
    <div class="code">${escapeHtml(input.item.unit_code)}</div>
    <img src="${src}" alt="${escapeHtml(input.item.barcode)}" />
    <div class="price">${escapeHtml(input.price)}</div>
  </article>`;
}

function printDocument(html: string, title: string) {
  const existing = document.getElementById("vasritha-print-frame");
  existing?.remove();

  const frame = document.createElement("iframe");
  frame.id = "vasritha-print-frame";
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    throw new Error("Could not open the print view");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const runPrint = () => {
    const win = frame.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
    window.setTimeout(() => frame.remove(), 1500);
  };

  const images = Array.from(doc.images);
  if (!images.length) {
    window.setTimeout(runPrint, 80);
    return;
  }
  let left = images.length;
  const done = () => {
    left -= 1;
    if (left <= 0) window.setTimeout(runPrint, 50);
  };
  for (const img of images) {
    if (img.complete) done();
    else {
      img.addEventListener("load", done);
      img.addEventListener("error", done);
    }
  }
  void title;
}

export function printProductStickers(input: {
  brand?: string;
  price: number | string;
  labelSize: "accessory" | "dress";
  items: StickerItem[];
}) {
  if (!input.items.length) {
    throw new Error("No unique barcodes to print. Save stock first, or inward more pieces.");
  }

  const brand = input.brand || "Vasritha Fashions";
  const defaultPrice = formatPrice(input.price);
  const defaultSize = input.labelSize === "accessory" ? "accessory" : "dress";

  const cards = input.items
    .map((item) => {
      const value = String(item.barcode || item.unit_code || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (!value) return "";
      const sizeClass =
        item.labelSize === "accessory" || item.labelSize === "dress"
          ? item.labelSize
          : defaultSize;
      const price = item.price != null ? formatPrice(item.price) : defaultPrice;
      return stickerHtml({
        brand,
        price,
        sizeClass,
        item: { ...item, barcode: value, unit_code: item.unit_code || value }
      });
    })
    .filter(Boolean)
    .join("");

  if (!cards) {
    throw new Error("Barcode values are invalid for printing.");
  }

  printDocument(
    `<!doctype html><html><head><title>Barcode stickers</title>
    <style>
      @page { margin: 4mm; size: auto; }
      html, body { margin: 0; background: #fff; color: #000; }
      body { font-family: Georgia, "Times New Roman", serif; }
      .sheet { display: flex; flex-wrap: wrap; gap: 5mm; padding: 4mm; }
      .sticker {
        border: 1px solid #111;
        border-radius: 3px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1.5px;
        box-sizing: border-box;
        padding: 2mm 2.5mm 1.5mm;
        break-inside: avoid;
        page-break-inside: avoid;
        background: #fff;
      }
      .sticker.accessory { width: 38mm; height: 25mm; }
      .sticker.dress { width: 50mm; height: 32mm; }
      .brand { font-size: 8px; font-weight: 700; line-height: 1.1; }
      .accessory .brand { font-size: 7px; }
      .code { font-family: ui-monospace, Consolas, monospace; font-size: 8px; letter-spacing: 0.02em; }
      .accessory .code { font-size: 6.5px; }
      .price { font-size: 9px; font-weight: 700; }
      .accessory .price { font-size: 8px; }
      img { max-width: 100%; height: auto; display: block; }
    </style></head><body>
    <div class="sheet">${cards}</div>
    </body></html>`,
    "Barcode stickers"
  );
}
