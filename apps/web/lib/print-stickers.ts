import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";

/** DB / API values (kept for compatibility). */
export type LabelSizeCode = "dress" | "accessory";

/** Print layout: 2-set = 50x25mm (2/row), 3-set = 34x25mm (3/row). */
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
    label: "3-set - 34x25 mm",
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
  slug?: string | null;
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
  slug?: string | null;
  color?: string | null;
  tag?: string | null;
  hsnCode?: string | null;
  compareAtPrice?: number | string | null;
  shopCode?: string | null;
};

type LayoutSpec = {
  cols: number;
  tagW: number;
  tagH: number;
};

const LAYOUT: Record<LabelLayout, LayoutSpec> = {
  set2: { cols: 2, tagW: 50, tagH: 25 },
  set3: { cols: 3, tagW: 34, tagH: 25 }
};

/** 203 dpi ≈ 8 dots per mm. */
const DOTS_PER_MM = 8;

type LabelCard = {
  brand: string;
  codeLabel: string;
  colorLabel: string;
  sizeLabel: string;
  priceLabel: string;
  scanValue: string;
  /** Small sideways reference text (product slug). */
  slugLabel: string;
};

/** Arial regular, center — sizes scale for 2-up vs 3-up. */
const LABEL_DPI = 203;
const LINE_GAP = Math.round(DOTS_PER_MM * 0.6);

function ptToDots(pt: number) {
  return Math.round((pt * LABEL_DPI) / 72);
}

function ptFont(sizeDots: number) {
  return `400 ${sizeDots}px Arial, Helvetica, sans-serif`;
}

function formatPrice(value: number | string) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "";
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  const amount = whole
    ? String(Math.round(n))
    : n.toFixed(2);
  return `Rs. ${amount}/-`;
}

function isHiddenSize(value: string) {
  const v = value.trim().toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return (
    !v ||
    v === "FREE SIZE" ||
    v === "FREESIZE" ||
    v === "FS" ||
    v === "FREE" ||
    v === "ONE SIZE" ||
    v === "ONESIZE" ||
    v === "DEFAULT" ||
    v === "N A" ||
    v === "NA" ||
    v === "-"
  );
}

/** Show size only when present and not free / one / default size. */
function resolveSizeLabel(sizeLabel: string | null | undefined) {
  const direct = String(sizeLabel || "").trim();
  if (!direct || isHiddenSize(direct)) return "";
  return direct.toUpperCase();
}

/** Draw CODE128 as solid black rectangles (no gray edges for the driver to dither). */
function drawBarcode(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxW: number,
  h: number
) {
  const probe = document.createElement("canvas");
  JsBarcode(probe, value, {
    format: "CODE128",
    width: 1,
    height: 10,
    margin: 0,
    displayValue: false,
    background: "#ffffff",
    lineColor: "#000000"
  });

  let moduleDots = Math.max(1, Math.floor(maxW / probe.width));
  if (moduleDots < 2 && probe.width * 2 <= maxW) moduleDots = 2;

  const src = document.createElement("canvas");
  JsBarcode(src, value, {
    format: "CODE128",
    width: moduleDots,
    height: 10,
    margin: 0,
    displayValue: false,
    background: "#ffffff",
    lineColor: "#000000"
  });
  const sctx = src.getContext("2d");
  if (!sctx) return;
  const row = sctx.getImageData(0, 0, src.width, 1).data;

  const drawW = Math.min(src.width, maxW);
  const x0 = Math.round(x + (maxW - drawW) / 2);
  const y0 = Math.round(y);
  ctx.fillStyle = "#000000";

  let col = 0;
  while (col < drawW) {
    const black = row[col * 4]! < 128;
    let end = col + 1;
    while (end < drawW && row[end * 4]! < 128 === black) end += 1;
    if (black) ctx.fillRect(x0 + col, y0, end - col, h);
    col = end;
  }
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  let value = text;
  while (value.length > 1 && ctx.measureText(value).width > maxW) {
    value = value.slice(0, -1);
  }
  return value === text ? value : `${value.slice(0, -1)}…`;
}

function drawLabelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  sizeDots: number
) {
  ctx.font = ptFont(sizeDots);
  const label = fitText(ctx, text, maxW);
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(label, Math.round(x), Math.round(y));
  return sizeDots;
}

/**
 * Tiny slug along the left edge, rotated for reference.
 * Inset from the physical left (printers clip ~1–2 mm); baseline grows into the label
 * so glyphs are not painted off the left edge (preview-only / missing on printout).
 */
function drawSideSlug(
  ctx: CanvasRenderingContext2D,
  text: string,
  x0: number,
  labelH: number,
  sizeDots: number
) {
  const raw = text.trim();
  if (!raw) return;
  ctx.save();
  // Normal weight, larger size — only the side slug is oversized vs other label text.
  const drawSize = Math.max(sizeDots, Math.round(DOTS_PER_MM * 1.05));
  ctx.font = `400 ${drawSize}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  // After -90° rotate, local +Y maps into the label (right). "top" keeps ink inside.
  ctx.textBaseline = "top";
  const maxLen = Math.max(8, labelH - Math.round(DOTS_PER_MM * 2));
  const label = fitText(ctx, raw, maxLen);
  // ~3.2 mm from left edge — room to paste / not flush in the corner.
  const leftInset = Math.round(DOTS_PER_MM * 3.2);
  ctx.translate(x0 + leftInset, labelH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function binarizeCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const luma = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
    // Higher threshold keeps thin rotated slug strokes that anti-alias to dark gray.
    const v = luma < 200 ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * VASRITHA · barcode · code · colour · size (skip free size) · price
 * Plus tiny sideways slug on the left edge for reference.
 * Layout auto-fits 2-up (50×25) and 3-up (34×25).
 */
function renderRowCanvas(spec: LayoutSpec, cards: LabelCard[]) {
  const labelW = spec.tagW * DOTS_PER_MM;
  const labelH = spec.tagH * DOTS_PER_MM;
  const canvas = document.createElement("canvas");
  canvas.width = labelW * spec.cols;
  canvas.height = labelH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare labels for printing");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  // 3-up is tighter; 2-up can use more room.
  // Extra left pad reserves a column for the sideways slug (avoids corner clip on print).
  const tight = spec.cols >= 3;
  const slugCol = Math.round(DOTS_PER_MM * (tight ? 4.8 : 5.2));
  const sidePad = slugCol + (tight ? 8 : 10);
  const pad = tight ? 7 : 9;
  const textPt = tight ? 6.5 : 7.5;
  const pricePt = tight ? 7.5 : 9;
  // Side slug only — larger than brand/code text, normal (not bold) weight.
  const slugPt = tight ? 8 : 9;
  const textDots = ptToDots(textPt);
  const priceDots = ptToDots(pricePt);
  const slugDots = ptToDots(slugPt);
  const barH = tight ? 50 : 58;

  cards.forEach((card, col) => {
    const x0 = col * labelW;
    const contentLeft = x0 + sidePad;
    const cx = contentLeft + (labelW - sidePad - pad) / 2;
    const innerW = labelW - sidePad - pad;

    const afterBarcode: Array<{ text: string; size: number }> = [
      { text: card.codeLabel, size: textDots }
    ];
    const color = card.colorLabel.trim();
    const size =
      card.sizeLabel && card.sizeLabel.toUpperCase() !== color.toUpperCase()
        ? card.sizeLabel.trim()
        : "";
    // On narrow 3-up, colour + size share one line so price still fits.
    if (color && size && tight) {
      afterBarcode.push({
        text: `${color.toUpperCase()} · ${size.toUpperCase()}`,
        size: textDots
      });
    } else {
      if (color) afterBarcode.push({ text: color.toUpperCase(), size: textDots });
      if (size) afterBarcode.push({ text: size.toUpperCase(), size: textDots });
    }
    if (card.priceLabel) {
      afterBarcode.push({ text: card.priceLabel, size: priceDots });
    }

    const afterH = afterBarcode.reduce((sum, line) => sum + line.size + LINE_GAP, 0);
    const contentH = textDots + LINE_GAP + barH + LINE_GAP + afterH;
    let y = Math.max(3, Math.round((labelH - contentH) / 2));

    drawSideSlug(ctx, card.slugLabel, x0, labelH, slugDots);

    drawLabelText(ctx, card.brand.toUpperCase(), cx, y, innerW, textDots);
    y += textDots + LINE_GAP;

    drawBarcode(ctx, card.scanValue, contentLeft, y, innerW, barH);
    y += barH + LINE_GAP;

    for (const line of afterBarcode) {
      drawLabelText(ctx, line.text, cx, y, innerW, line.size);
      y += line.size + LINE_GAP;
    }
  });

  binarizeCanvas(canvas);
  return canvas;
}

/** Simple label print — no rotation / printer property UI. */
export async function printProductStickers(input: {
  brand?: string;
  price: number | string;
  layout?: LabelLayout;
  labelSize?: LabelSizeCode;
  meta?: StickerProductMeta;
  items: StickerItem[];
}) {
  if (!input.items.length) {
    throw new Error("No unique barcodes to print. Save stock first, or inward more pieces.");
  }

  try {
    window.localStorage.removeItem("vasritha.labelPrintRotation");
  } catch {
    /* ignore */
  }

  const brand =
    (input.brand || input.meta?.brand || "VASRITHA").replace(/\s+BOUTIQUE$/i, "").trim() ||
    "VASRITHA";
  const defaultPrice = formatPrice(input.price);
  const defaultLayout = input.layout || labelSizeToLayout(input.labelSize || "dress");
  const spec = LAYOUT[defaultLayout];

  const cards: LabelCard[] = [];
  for (const raw of input.items) {
    const scanValue = String(raw.barcode || raw.unit_code || "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    if (!scanValue) continue;

    const unitCode = String(raw.unit_code || raw.barcode || raw.sku || scanValue).trim();
    const priceLabel =
      raw.price != null && raw.price !== "" ? formatPrice(raw.price) : defaultPrice;

    cards.push({
      brand,
      codeLabel: unitCode,
      colorLabel: String(raw.color || input.meta?.color || "").trim(),
      sizeLabel: resolveSizeLabel(raw.sizeLabel),
      priceLabel,
      scanValue,
      slugLabel: String(raw.slug || input.meta?.slug || "").trim()
    });
  }

  if (!cards.length) {
    throw new Error("Barcode values are invalid for printing.");
  }

  const pageW = spec.tagW * spec.cols;
  const pageH = spec.tagH;
  const rowCount = Math.ceil(cards.length / spec.cols);
  const rows: HTMLCanvasElement[] = [];
  for (let row = 0; row < rowCount; row += 1) {
    rows.push(renderRowCanvas(spec, cards.slice(row * spec.cols, row * spec.cols + spec.cols)));
  }

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [pageW, pageH],
    compress: true
  });
  // Empty metadata so the print dialog does not show a title/header.
  doc.setProperties({ title: "", subject: "", author: "", creator: "" });
  rows.forEach((canvas, row) => {
    if (row > 0) doc.addPage([pageW, pageH], "landscape");
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH, undefined, "NONE");
  });

  const pdfUrl = URL.createObjectURL(doc.output("blob"));
  showLabelPreview({
    pdfUrl,
    fileName: `labels-${defaultLayout}-${Date.now()}.pdf`,
    pageW,
    pageH,
    rows
  });
}

function showLabelPreview(input: {
  pdfUrl: string;
  fileName: string;
  pageW: number;
  pageH: number;
  rows: HTMLCanvasElement[];
}) {
  document.getElementById("vasritha-label-preview")?.remove();
  document.getElementById("vasritha-label-print-frame")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "vasritha-label-preview";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:100000;background:rgba(20,12,6,.55);display:flex;align-items:center;justify-content:center;padding:16px;";

  const panel = document.createElement("div");
  panel.style.cssText =
    "background:#fff;border-radius:14px;width:min(760px,100%);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:Arial,Helvetica,sans-serif;";

  const head = document.createElement("div");
  head.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #eee;";

  const title = document.createElement("strong");
  const rowCount = input.rows.length;
  title.textContent = `Labels · ${input.pageW} × ${input.pageH} mm · ${rowCount} row${rowCount === 1 ? "" : "s"}`;
  title.style.cssText = "font-size:15px;color:#2b1a10;";

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";

  const makeBtn = (label: string, primary = false) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.cssText = primary
      ? "background:#422314;color:#fff;border:0;border-radius:999px;padding:8px 16px;font-weight:700;cursor:pointer;"
      : "background:#fff;color:#422314;border:1px solid #d8c7b6;border-radius:999px;padding:8px 16px;font-weight:600;cursor:pointer;";
    return btn;
  };

  const printBtn = makeBtn("Print", true);
  const downloadBtn = makeBtn("Download PDF");
  const closeBtn = makeBtn("Close");

  const preview = document.createElement("div");
  preview.style.cssText =
    "overflow:auto;padding:16px;background:#f4f4f4;display:flex;flex-direction:column;gap:10px;align-items:center;max-height:min(60vh,520px);";
  for (const canvas of input.rows) {
    const img = document.createElement("img");
    img.src = canvas.toDataURL("image/png");
    img.alt = "Label row";
    img.style.cssText =
      "width:min(100%,520px);height:auto;background:#fff;image-rendering:pixelated;box-shadow:0 1px 4px rgba(0,0,0,.12);";
    preview.appendChild(img);
  }

  const close = () => {
    overlay.remove();
    document.getElementById("vasritha-label-print-frame")?.remove();
    window.setTimeout(() => URL.revokeObjectURL(input.pdfUrl), 60_000);
  };

  const tip = document.createElement("div");
  tip.style.cssText =
    "padding:8px 16px;font-size:12px;color:#5c4030;background:#faf6f1;border-bottom:1px solid #eee;line-height:1.45;";
  tip.innerHTML =
    `Crisp bitmap print · Paper <b>${input.pageW} × ${input.pageH} mm</b> (one label row) · Scale <b>100% / Actual size</b> · Margins <b>None</b> · ` +
    "Headers and footers <b>OFF</b>. If row 2+ drifts, set the printer to this same size and Gap/Mark feed — not extra form-feed between pages.";

  printBtn.addEventListener("click", () => printLabelRows(input.rows, input.pageW, input.pageH));
  downloadBtn.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = input.pdfUrl;
    a.download = input.fileName;
    a.click();
  });
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  actions.append(printBtn, downloadBtn, closeBtn);
  head.append(title, actions);
  panel.append(head, tip, preview);
  overlay.append(panel);
  document.body.appendChild(overlay);
}

/**
 * Print PNG rows directly (not PDF). PDF re-encoding softens bars/text.
 *
 * Each row is one label (e.g. 102×25 mm). Extra CSS page-breaks / Chrome “fit”
 * add ~0.5–2 mm of feed per row, so 1 row looks fine and 2+ rows drift.
 * Keep one named page size, one break between rows, zero body gaps.
 */
function printLabelRows(rows: HTMLCanvasElement[], pageW: number, pageH: number) {
  if (!rows.length) return;
  document.getElementById("vasritha-label-print-frame")?.remove();

  const frame = document.createElement("iframe");
  frame.id = "vasritha-label-print-frame";
  frame.title = " ";
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    window.alert("Could not open the print dialog.");
    return;
  }

  const pages = rows
    .map(
      (canvas, i) =>
        `<div class="page${i === rows.length - 1 ? " is-last" : ""}"><img src="${canvas.toDataURL("image/png")}" width="${canvas.width}" height="${canvas.height}" alt="" /></div>`
    )
    .join("");

  doc.open();
  doc.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>&nbsp;</title>
<style>
  @page label {
    size: ${pageW}mm ${pageH}mm;
    margin: 0;
  }
  @page { size: ${pageW}mm ${pageH}mm; margin: 0; }
  html, body {
    margin: 0;
    padding: 0;
    width: ${pageW}mm;
    background: #fff;
    font-size: 0;
    line-height: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    page: label;
    box-sizing: border-box;
    width: ${pageW}mm;
    height: ${pageH}mm;
    margin: 0;
    padding: 0;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  /* One break BETWEEN rows only — not also on the last page (that extra
     form-feed is what walks later labels off the sticker). */
  .page:not(.is-last) {
    page-break-after: always;
    break-after: page;
  }
  img {
    display: block;
    width: ${pageW}mm;
    height: ${pageH}mm;
    max-width: none;
    max-height: none;
    border: 0;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
</style></head><body>${pages}</body></html>`);
  doc.close();

  const runPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      window.alert("Could not open the print dialog.");
    } finally {
      window.setTimeout(() => document.getElementById("vasritha-label-print-frame")?.remove(), 2500);
    }
  };

  Promise.all(
    Array.from(doc.images).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  ).then(() => {
    win.requestAnimationFrame(() => {
      win.requestAnimationFrame(() => window.setTimeout(runPrint, 300));
    });
  });
}
