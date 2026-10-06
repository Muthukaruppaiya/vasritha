import { barcodeDataUrl, escapePrintHtml } from "./print-barcodes";

/** DB / API values (kept for compatibility). */
export type LabelSizeCode = "dress" | "accessory";

/** Print layout: 2-set = 50×25mm (2/row), 3-set = 35×22mm (3/row). */
export type LabelLayout = "set2" | "set3";

export function labelSizeToLayout(size: LabelSizeCode | string | null | undefined): LabelLayout {
  return size === "accessory" ? "set3" : "set2";
}

export function layoutToLabelSize(layout: LabelLayout): LabelSizeCode {
  return layout === "set3" ? "accessory" : "dress";
}

export const LABEL_LAYOUT_OPTIONS: Array<{
  value: LabelLayout;
  code: LabelSizeCode;
  label: string;
  hint: string;
}> = [
  {
    value: "set2",
    code: "dress",
    label: "2-set · 50×25 mm",
    hint: "2 labels per row"
  },
  {
    value: "set3",
    code: "accessory",
    label: "3-set · 35×22 mm",
    hint: "3 labels per row"
  }
];

export type StickerItem = {
  id?: string;
  unit_code: string;
  barcode: string;
  tag?: string;
  seq?: number;
  sizeLabel?: string | null;
  price?: number | string;
  labelSize?: LabelSizeCode;
  productName?: string;
  shortName?: string | null;
  categoryName?: string | null;
  sku?: string | null;
  color?: string | null;
  hsnCode?: string | null;
  compareAtPrice?: number | string | null;
};

export type StickerProductMeta = {
  brand?: string;
  productName?: string;
  shortName?: string | null;
  categoryName?: string | null;
  sku?: string | null;
  color?: string | null;
  tag?: string | null;
  hsnCode?: string | null;
  compareAtPrice?: number | string | null;
  shopCode?: string | null;
};

/** Price without currency prefix (e.g. 9,990.00). */
function formatPrice(value: number | string) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function splitUnitCode(code: string) {
  const parts = String(code || "")
    .split(/[\/\-]/)
    .map((part) => part.trim())
    .filter(Boolean);
  // No D.No line on sale tags
  return {
    line1: parts[0] || code,
    line2: parts[1] || ""
  };
}

function printDocument(html: string) {
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
}

function stickerHtml(input: {
  brand: string;
  meta: StickerProductMeta;
  price: string;
  layout: LabelLayout;
  item: StickerItem;
  barcodeSrc: string;
}) {
  const codes = splitUnitCode(input.item.unit_code);
  const category = (
    input.item.categoryName ||
    input.meta.categoryName ||
    "APPAREL"
  ).toUpperCase();
  const displayName = (
    input.item.shortName ||
    input.meta.shortName ||
    input.item.productName ||
    input.meta.productName ||
    category
  )
    .trim()
    .toUpperCase();
  const ref = input.item.tag || input.item.sku || input.meta.sku || input.item.unit_code;
  const codesLine = [codes.line1, codes.line2].filter(Boolean).join(" · ");

  return `<article class="sale-tag ${input.layout}">
    <header class="sale-tag-brand">
      <span class="sale-tag-mark" aria-hidden="true">V</span>
      <strong>${escapePrintHtml(input.brand)}</strong>
    </header>
    <section class="sale-tag-body">
      <div class="sale-tag-codes">${escapePrintHtml(codesLine)}</div>
      <div class="sale-tag-name">${escapePrintHtml(displayName)}</div>
    </section>
    <section class="sale-tag-mid">
      <div class="sale-tag-ref">${escapePrintHtml(String(ref))}</div>
      <div class="sale-tag-price">${escapePrintHtml(input.price)}</div>
    </section>
    <img class="sale-tag-barcode" src="${input.barcodeSrc}" alt="${escapePrintHtml(input.item.barcode)}" />
  </article>`;
}

export async function printProductStickers(input: {
  brand?: string;
  price: number | string;
  /** Preferred: set2 | set3. Falls back from labelSize dress/accessory. */
  layout?: LabelLayout;
  labelSize?: LabelSizeCode;
  meta?: StickerProductMeta;
  items: StickerItem[];
}) {
  if (!input.items.length) {
    throw new Error("No unique barcodes to print. Save stock first, or inward more pieces.");
  }

  const brand = input.brand || input.meta?.brand || "VASRITHA BOUTIQUE";
  const defaultPrice = formatPrice(input.price);
  const defaultLayout =
    input.layout || labelSizeToLayout(input.labelSize || "dress");
  const meta = input.meta || {};

  const cards: string[] = [];
  for (const raw of input.items) {
    const value = String(raw.barcode || raw.unit_code || "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    if (!value) continue;

    const price = raw.price != null ? formatPrice(raw.price) : defaultPrice;
    const item = { ...raw, barcode: value, unit_code: raw.unit_code || value };
    const barcodeSrc = barcodeDataUrl(
      value,
      defaultLayout === "set3" ? 22 : 28,
      defaultLayout === "set3" ? 1 : 1.15
    );

    cards.push(
      stickerHtml({
        brand,
        meta,
        price,
        layout: defaultLayout,
        item,
        barcodeSrc
      })
    );
  }

  if (!cards.length) {
    throw new Error("Barcode values are invalid for printing.");
  }

  const sheetClass = defaultLayout === "set3" ? "set-3" : "set-2";

  printDocument(
    `<!doctype html><html><head><title>Vasritha sale tags</title>
    <style>
      @page { margin: 3mm; size: auto; }
      html, body { margin: 0; background: #fff; color: #2c1a10; }
      body { font-family: Arial, Helvetica, sans-serif; }
      .sheet {
        display: grid;
        gap: 2mm;
        padding: 2mm;
        justify-content: start;
      }
      .sheet.set-2 { grid-template-columns: repeat(2, 50mm); }
      .sheet.set-3 { grid-template-columns: repeat(3, 35mm); }
      .sale-tag {
        border: 1px solid #422314;
        border-radius: 2px;
        box-sizing: border-box;
        padding: 1.2mm 1.6mm 0.9mm;
        background: #fff;
        break-inside: avoid;
        page-break-inside: avoid;
        display: grid;
        grid-template-rows: auto auto auto auto;
        align-content: start;
        row-gap: 0.45mm;
        overflow: hidden;
      }
      .sale-tag.set2 { width: 50mm; height: 25mm; font-size: 5.5px; }
      .sale-tag.set3 { width: 35mm; height: 22mm; font-size: 4.4px; padding: 0.9mm 1.1mm 0.7mm; row-gap: 0.35mm; }
      .sale-tag-brand {
        display: flex;
        align-items: center;
        gap: 1.2mm;
        border-bottom: 0.6px solid #c89b5c;
        padding: 0 0 0.35mm;
        margin: 0;
        min-height: 3.8mm;
      }
      .set3 .sale-tag-brand { min-height: 3.2mm; padding-bottom: 0.25mm; gap: 0.9mm; }
      .sale-tag-mark {
        width: 4.2mm;
        height: 4.2mm;
        border-radius: 50%;
        background: #422314;
        color: #c89b5c;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 5.2px;
        line-height: 1;
        flex-shrink: 0;
      }
      .set3 .sale-tag-mark { width: 3.2mm; height: 3.2mm; font-size: 4.2px; }
      .sale-tag-brand strong {
        font-size: 6.2px;
        letter-spacing: 0.04em;
        color: #422314;
        line-height: 1.05;
        font-weight: 800;
        text-transform: uppercase;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .set3 .sale-tag-brand strong { font-size: 4.8px; letter-spacing: 0.03em; }
      .sale-tag-body {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.25mm;
        margin: 0;
        padding: 0;
        min-width: 0;
      }
      .sale-tag-codes {
        font-weight: 700;
        line-height: 1.15;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sale-tag-name {
        font-weight: 800;
        color: #422314;
        line-height: 1.12;
        white-space: normal;
        word-break: break-word;
        overflow-wrap: anywhere;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
        font-size: 6px;
        text-align: left;
        max-height: 2.4em;
      }
      .set3 .sale-tag-name { font-size: 4.8px; }
      .sale-tag-mid {
        text-align: center;
        line-height: 1.05;
        padding: 0.1mm 0 0;
        border-top: 0.4px solid #efe4d8;
        margin: 0;
      }
      .sale-tag-ref {
        font-size: 5px;
        font-weight: 700;
        letter-spacing: 0.03em;
        color: #422314;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }
      .set3 .sale-tag-ref { font-size: 4px; }
      .sale-tag-price {
        font-size: 9.5px;
        font-weight: 800;
        letter-spacing: 0.01em;
        color: #422314;
        line-height: 1.05;
        margin-top: 0.1mm;
      }
      .set3 .sale-tag-price { font-size: 7.5px; }
      .sale-tag-barcode {
        width: 100%;
        height: 4.6mm;
        object-fit: contain;
        object-position: center;
        display: block;
        margin: 0;
      }
      .set3 .sale-tag-barcode { height: 3.8mm; }
    </style></head><body>
    <div class="sheet ${sheetClass}">${cards.join("")}</div>
    </body></html>`
  );
}
