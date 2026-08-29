import { barcodeDataUrl, escapePrintHtml, qrDataUrl } from "./print-barcodes";

export type StickerItem = {
  id?: string;
  unit_code: string;
  barcode: string;
  tag?: string;
  seq?: number;
  sizeLabel?: string | null;
  price?: number | string;
  labelSize?: "accessory" | "dress";
  productName?: string;
  categoryName?: string;
  sku?: string | null;
  color?: string | null;
  compareAtPrice?: number | string | null;
};

export type StickerProductMeta = {
  brand?: string;
  productName?: string;
  categoryName?: string;
  sku?: string | null;
  color?: string | null;
  tag?: string | null;
  compareAtPrice?: number | string | null;
  shopCode?: string | null;
};

function formatPrice(value: number | string) {
  return `Rs.${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function splitUnitCode(code: string) {
  const parts = String(code || "")
    .split(/[\/\-]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    line1: parts[0] || code,
    line2: parts[1] || "",
    line3: parts[2] ? `D.No:${parts[2]}` : ""
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
  mrp?: string | null;
  sizeClass: "accessory" | "dress";
  item: StickerItem;
  barcodeSrc: string;
  qrSrc: string;
}) {
  const codes = splitUnitCode(input.item.unit_code);
  const category = (input.item.categoryName || input.meta.categoryName || "APPAREL").toUpperCase();
  const counter = (input.item.productName || input.meta.productName || category).toUpperCase();
  const size = input.item.sizeLabel || input.item.color || input.meta.color || input.meta.tag || "—";
  const ref = input.item.tag || input.item.sku || input.meta.sku || input.item.unit_code;
  const shop = input.meta.shopCode || "VAS";
  const itemMrp =
    input.item.compareAtPrice != null &&
    Number(input.item.compareAtPrice) > Number(input.price.replace(/[^\d.]/g, ""))
      ? formatPrice(input.item.compareAtPrice)
      : input.mrp;

  return `<article class="sale-tag ${input.sizeClass}">
    <header class="sale-tag-brand">
      <span class="sale-tag-mark" aria-hidden="true">V</span>
      <strong>${escapePrintHtml(input.brand)}</strong>
    </header>
    <div class="sale-tag-grid">
      <div class="sale-tag-left">
        <div>${escapePrintHtml(codes.line1)}</div>
        ${codes.line2 ? `<div>${escapePrintHtml(codes.line2)}</div>` : ""}
        ${codes.line3 ? `<div>${escapePrintHtml(codes.line3)}</div>` : ""}
      </div>
      <div class="sale-tag-right">
        <div>C/</div>
        <div>${escapePrintHtml(shop)}</div>
        <div class="sale-tag-dept">${escapePrintHtml(category)}</div>
        <div class="sale-tag-counter">${escapePrintHtml(counter)}</div>
      </div>
    </div>
    <div class="sale-tag-mid">
      <img class="sale-tag-qr" src="${input.qrSrc}" alt="" />
      <div class="sale-tag-price-block">
        <div class="sale-tag-ref">${escapePrintHtml(ref)}</div>
        <div class="sale-tag-price">${escapePrintHtml(input.price)}</div>
        ${itemMrp ? `<div class="sale-tag-mrp">MRP ${escapePrintHtml(itemMrp)}</div>` : ""}
      </div>
    </div>
    <img class="sale-tag-barcode" src="${input.barcodeSrc}" alt="${escapePrintHtml(input.item.barcode)}" />
    <footer class="sale-tag-foot">
      <span class="sale-tag-barcode-num">${escapePrintHtml(input.item.barcode)}</span>
      <span class="sale-tag-size">SIZE : ${escapePrintHtml(String(size))}</span>
      <span class="sale-tag-shop">${escapePrintHtml(shop)}${input.item.seq ? input.item.seq : ""}</span>
    </footer>
  </article>`;
}

export async function printProductStickers(input: {
  brand?: string;
  price: number | string;
  labelSize: "accessory" | "dress";
  meta?: StickerProductMeta;
  items: StickerItem[];
}) {
  if (!input.items.length) {
    throw new Error("No unique barcodes to print. Save stock first, or inward more pieces.");
  }

  const brand = input.brand || input.meta?.brand || "VASRITHA FASHIONS";
  const defaultPrice = formatPrice(input.price);
  const defaultSize = input.labelSize === "accessory" ? "accessory" : "dress";
  const meta = input.meta || {};
  const mrp =
    meta.compareAtPrice != null && Number(meta.compareAtPrice) > Number(input.price)
      ? formatPrice(meta.compareAtPrice)
      : null;

  const cards: string[] = [];
  for (const raw of input.items) {
    const value = String(raw.barcode || raw.unit_code || "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    if (!value) continue;

    const sizeClass =
      raw.labelSize === "accessory" || raw.labelSize === "dress" ? raw.labelSize : defaultSize;
    const price = raw.price != null ? formatPrice(raw.price) : defaultPrice;
    const item = { ...raw, barcode: value, unit_code: raw.unit_code || value };
    const barcodeSrc = barcodeDataUrl(value, sizeClass === "accessory" ? 28 : 34, 1.2);
    const qrSrc = await qrDataUrl(value, sizeClass === "accessory" ? 56 : 68);

    cards.push(
      stickerHtml({
        brand,
        meta,
        price,
        mrp,
        sizeClass,
        item,
        barcodeSrc,
        qrSrc
      })
    );
  }

  if (!cards.length) {
    throw new Error("Barcode values are invalid for printing.");
  }

  printDocument(
    `<!doctype html><html><head><title>Sale tags</title>
    <style>
      @page { margin: 4mm; size: auto; }
      html, body { margin: 0; background: #fff; color: #000; }
      body { font-family: Arial, Helvetica, sans-serif; }
      .sheet { display: flex; flex-wrap: wrap; gap: 4mm; padding: 3mm; }
      .sale-tag {
        border: 1px solid #111;
        border-radius: 4px;
        box-sizing: border-box;
        padding: 2.5mm 3mm 2mm;
        background: #fff;
        break-inside: avoid;
        page-break-inside: avoid;
        display: flex;
        flex-direction: column;
        gap: 1.5mm;
      }
      .sale-tag.accessory { width: 42mm; min-height: 34mm; font-size: 6px; }
      .sale-tag.dress { width: 72mm; min-height: 52mm; font-size: 7px; }
      .sale-tag-brand {
        display: flex;
        align-items: center;
        gap: 2mm;
        border-bottom: 1px solid #111;
        padding-bottom: 1mm;
      }
      .sale-tag-mark {
        width: 7mm;
        height: 7mm;
        border-radius: 50%;
        background: #1f5f2d;
        color: #fff;
        display: grid;
        place-items: center;
        font-weight: 800;
        font-size: 8px;
      }
      .accessory .sale-tag-mark { width: 5mm; height: 5mm; font-size: 6px; }
      .sale-tag-brand strong {
        font-size: 9px;
        letter-spacing: 0.04em;
        color: #1f5f2d;
        line-height: 1.1;
      }
      .accessory .sale-tag-brand strong { font-size: 7px; }
      .sale-tag-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2mm;
        line-height: 1.2;
      }
      .sale-tag-left { font-weight: 700; }
      .sale-tag-right { text-align: right; }
      .sale-tag-dept { font-weight: 800; margin-top: 0.5mm; }
      .sale-tag-counter { font-size: 6px; font-weight: 700; }
      .accessory .sale-tag-counter { font-size: 5px; }
      .sale-tag-mid {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 2mm;
        align-items: center;
      }
      .sale-tag-qr { width: 16mm; height: 16mm; object-fit: contain; }
      .accessory .sale-tag-qr { width: 11mm; height: 11mm; }
      .sale-tag-price-block { text-align: center; }
      .sale-tag-ref { font-size: 6px; margin-bottom: 0.5mm; }
      .sale-tag-price {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.02em;
      }
      .accessory .sale-tag-price { font-size: 10px; }
      .sale-tag-mrp {
        font-size: 6px;
        text-decoration: line-through;
        color: #444;
      }
      .sale-tag-barcode {
        width: 100%;
        height: auto;
        display: block;
      }
      .sale-tag-foot {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 1mm;
        align-items: end;
        font-size: 6px;
        font-weight: 700;
      }
      .accessory .sale-tag-foot { font-size: 5px; }
      .sale-tag-barcode-num { letter-spacing: 0.04em; }
      .sale-tag-size { white-space: nowrap; }
      .sale-tag-shop { text-align: right; }
    </style></head><body>
    <div class="sheet">${cards.join("")}</div>
    </body></html>`
  );
}
