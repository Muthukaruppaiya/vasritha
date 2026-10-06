import { barcodeDataUrl, escapePrintHtml } from "./print-barcodes";

/** DB / API values (kept for compatibility). */
export type LabelSizeCode = "dress" | "accessory";

/** Print layout: 2-set = 50x25mm (2/row), 3-set = 35x22mm (3/row). */
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
    label: "2-set - 50x25 mm",
    hint: "2 labels per row"
  },
  {
    value: "set3",
    code: "accessory",
    label: "3-set - 35x22 mm",
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

type LayoutSpec = {
  cols: number;
  tagW: string;
  tagH: string;
  barH: number;
  barW: number;
  brandPx: string;
  codePx: string;
  pricePx: string;
  barMm: string;
};

const LAYOUT: Record<LabelLayout, LayoutSpec> = {
  set2: {
    cols: 2,
    tagW: "50mm",
    tagH: "25mm",
    barH: 42,
    barW: 1.35,
    brandPx: "9px",
    codePx: "7px",
    pricePx: "10px",
    barMm: "8.8mm"
  },
  set3: {
    cols: 3,
    tagW: "35mm",
    tagH: "22mm",
    barH: 34,
    barW: 1.2,
    brandPx: "7px",
    codePx: "5.5px",
    pricePx: "8px",
    barMm: "7.2mm"
  }
};

/** Price like Rs. 27000/- ? ASCII so thermal printers never show "?" for the rupee mark. */
function formatPrice(value: number | string) {
  const n = Number(value || 0);
  const whole = Number.isFinite(n) && Math.abs(n - Math.round(n)) < 0.005;
  const amount = whole
    ? Math.round(n).toLocaleString("en-IN")
    : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `Rs. ${amount}/-`;
}

function printDocument(html: string) {
  return new Promise<void>((resolve, reject) => {
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
      reject(new Error("Could not open the print view"));
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const runPrint = () => {
      const win = frame.contentWindow;
      if (!win) {
        frame.remove();
        reject(new Error("Could not open the print view"));
        return;
      }
      win.focus();
      win.print();
      window.setTimeout(() => {
        frame.remove();
        resolve();
      }, 800);
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
  });
}

function stickerHtml(input: {
  brand: string;
  price: string;
  codeLabel: string;
  barcodeSrc: string;
  barcodeAlt: string;
}) {
  return `<article class="sale-tag">
    <strong class="sale-tag-brand">${escapePrintHtml(input.brand)}</strong>
    <img class="sale-tag-barcode" src="${input.barcodeSrc}" alt="${escapePrintHtml(input.barcodeAlt)}" />
    <div class="sale-tag-code">${escapePrintHtml(input.codeLabel)}</div>
    <div class="sale-tag-price">${escapePrintHtml(input.price)}</div>
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

  const brand =
    (input.brand || input.meta?.brand || "VASRITHA").replace(/\s+BOUTIQUE$/i, "").trim() ||
    "VASRITHA";
  const defaultPrice = formatPrice(input.price);
  const defaultLayout = input.layout || labelSizeToLayout(input.labelSize || "dress");
  const spec = LAYOUT[defaultLayout];

  const cards: string[] = [];
  for (const raw of input.items) {
    const scanValue = String(raw.barcode || raw.unit_code || "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    if (!scanValue) continue;

    const price = raw.price != null ? formatPrice(raw.price) : defaultPrice;
    const codeLabel = String(raw.unit_code || raw.barcode || raw.sku || scanValue).trim();
    const barcodeSrc = barcodeDataUrl(scanValue, spec.barH, spec.barW);

    cards.push(
      stickerHtml({
        brand,
        price,
        codeLabel,
        barcodeSrc,
        barcodeAlt: scanValue
      })
    );
  }

  if (!cards.length) {
    throw new Error("Barcode values are invalid for printing.");
  }

  const rows: string[] = [];
  for (let i = 0; i < cards.length; i += spec.cols) {
    const slice = cards.slice(i, i + spec.cols);
    while (slice.length < spec.cols) {
      slice.push(`<td class="sale-tag-cell sale-tag-cell--blank" aria-hidden="true"></td>`);
    }
    const cells = slice.map((card) =>
      card.startsWith("<td")
        ? card
        : `<td class="sale-tag-cell">${card}</td>`
    );
    rows.push(`<tr class="sale-tag-row">${cells.join("")}</tr>`);
  }

  await printDocument(
    `<!doctype html><html><head><title>Vasritha stickers</title>
    <style>
      @page { size: auto; margin: 4mm; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
      }
      body { font-family: Arial, Helvetica, sans-serif; }
      /* Table rows keep whole stickers together across page breaks */
      .sheet {
        border-collapse: collapse;
        border-spacing: 0;
        width: calc(${spec.cols} * ${spec.tagW} + ${(spec.cols - 1) * 2}mm);
        max-width: 100%;
        margin: 0;
        padding: 0;
      }
      .sale-tag-row {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .sale-tag-cell {
        width: ${spec.tagW};
        height: ${spec.tagH};
        padding: 0 1mm 2mm 0;
        vertical-align: top;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .sale-tag-cell--blank {
        visibility: hidden;
      }
      .sale-tag {
        width: ${spec.tagW};
        height: ${spec.tagH};
        margin: 0;
        padding: 1mm 1.4mm;
        background: #fff;
        border: 0;
        overflow: hidden;
        text-align: center;
      }
      .sale-tag-brand {
        display: block;
        font-family: Georgia, "Times New Roman", Times, serif;
        font-size: ${spec.brandPx};
        font-weight: 700;
        letter-spacing: 0.04em;
        line-height: 1.05;
        text-transform: uppercase;
        color: #000;
        margin: 0 0 0.4mm;
      }
      .sale-tag-barcode {
        display: block;
        width: 96%;
        max-width: 96%;
        height: ${spec.barMm};
        margin: 0 auto 0.4mm;
        object-fit: contain;
        object-position: center;
        image-rendering: crisp-edges;
        -ms-interpolation-mode: nearest-neighbor;
      }
      .sale-tag-code {
        display: block;
        font-size: ${spec.codePx};
        font-weight: 600;
        letter-spacing: 0.02em;
        line-height: 1.05;
        color: #000;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        margin: 0 0 0.3mm;
      }
      .sale-tag-price {
        display: block;
        font-size: ${spec.pricePx};
        font-weight: 800;
        letter-spacing: 0.01em;
        line-height: 1;
        color: #000;
        white-space: nowrap;
        margin: 0;
      }
      @media print {
        html, body { margin: 0; }
        .sale-tag-row,
        .sale-tag-cell {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .sale-tag-barcode {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    </style></head><body>
    <table class="sheet"><tbody>${rows.join("")}</tbody></table>
    </body></html>`
  );
}
