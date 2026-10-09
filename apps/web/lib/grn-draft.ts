export type GrnColorSplit = {
  color: string;
  quantity: string;
};

export type GrnDraftLine = {
  productVariantId: string;
  quantity: string;
  purchasePrice: string;
  /** Colour-wise qty when product is multi-colour. Sum must match quantity. */
  colorSplits?: GrnColorSplit[];
  /** Free-text search hint when SKU was missing */
  searchHint?: string;
};

export type GrnDraft = {
  supplierId: string;
  /** Legacy free-text kept for older drafts */
  supplier: string;
  billNo: string;
  invoiceAmount: string;
  invoiceDate: string;
  /** Whole-GRN discount in ₹ */
  discountAmount: string;
  /** Whole-GRN tax in ₹ */
  taxAmount: string;
  documentPath: string;
  documentName: string;
  note: string;
  lines: GrnDraftLine[];
  /** Which line index to fill after creating a product */
  focusLineIndex: number;
  savedAt: string;
};

const STORAGE_KEY = "vasritha_grn_draft_v1";

export function blankColorSplit(): GrnColorSplit {
  return { color: "", quantity: "1" };
}

export function blankGrnDraft(variantId = ""): GrnDraft {
  return {
    supplierId: "",
    supplier: "",
    billNo: "",
    invoiceAmount: "",
    invoiceDate: "",
    discountAmount: "0",
    taxAmount: "0",
    documentPath: "",
    documentName: "",
    note: "",
    lines: [{ productVariantId: variantId, quantity: "1", purchasePrice: "" }],
    focusLineIndex: 0,
    savedAt: new Date().toISOString()
  };
}

export function saveGrnDraft(draft: GrnDraft) {
  if (typeof window === "undefined") return;
  const payload: GrnDraft = {
    ...draft,
    savedAt: new Date().toISOString()
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadGrnDraft(): GrnDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GrnDraft & {
      lines: Array<GrnDraftLine & { discount?: string; tax?: string }>;
    };
    if (!parsed || !Array.isArray(parsed.lines) || !parsed.lines.length) return null;

    let discountAmount = String(parsed.discountAmount ?? "");
    let taxAmount = String(parsed.taxAmount ?? "");
    if (!discountAmount && !taxAmount) {
      const lineDisc = parsed.lines.reduce((sum, line) => {
        const d = Number(line.discount);
        return sum + (Number.isFinite(d) && d > 0 ? d : 0);
      }, 0);
      const lineTax = parsed.lines.reduce((sum, line) => {
        const t = Number(line.tax);
        return sum + (Number.isFinite(t) && t > 0 ? t : 0);
      }, 0);
      discountAmount = String(lineDisc || 0);
      taxAmount = String(lineTax || 0);
    }
    if (!discountAmount) discountAmount = "0";
    if (!taxAmount) taxAmount = "0";

    return {
      supplierId: String(parsed.supplierId || ""),
      supplier: String(parsed.supplier || ""),
      billNo: String(parsed.billNo || ""),
      invoiceAmount: String(parsed.invoiceAmount || ""),
      invoiceDate: String(parsed.invoiceDate || ""),
      discountAmount,
      taxAmount,
      documentPath: String(parsed.documentPath || ""),
      documentName: String(parsed.documentName || ""),
      note: String(parsed.note || ""),
      focusLineIndex: Number.isFinite(parsed.focusLineIndex) ? Number(parsed.focusLineIndex) : 0,
      savedAt: parsed.savedAt || new Date().toISOString(),
      lines: parsed.lines.map((line) => ({
        productVariantId: String(line.productVariantId || ""),
        quantity: String(line.quantity || "1"),
        purchasePrice: String(line.purchasePrice || ""),
        colorSplits: Array.isArray(line.colorSplits)
          ? line.colorSplits.map((s) => ({
              color: String(s.color || ""),
              quantity: String(s.quantity || "1")
            }))
          : undefined,
        searchHint: line.searchHint ? String(line.searchHint) : undefined
      }))
    };
  } catch {
    return null;
  }
}

export function clearGrnDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Line total = qty × purchase (discount/tax are GRN-level). */
export function lineTotal(quantity: string | number, purchasePrice: string | number) {
  const qty = Number(quantity);
  const price = Number(purchasePrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price < 0) return 0;
  return Math.round(qty * price * 100) / 100;
}

export function draftLinesTotal(lines: GrnDraftLine[]) {
  return lines.reduce((sum, line) => sum + lineTotal(line.quantity, line.purchasePrice), 0);
}

/** Grand total = lines − discount + tax. */
export function draftGrandTotal(
  lines: GrnDraftLine[],
  discountAmount: string | number,
  taxAmount: string | number
) {
  const linesSum = draftLinesTotal(lines);
  const disc = Number(discountAmount);
  const tax = Number(taxAmount);
  const d = Number.isFinite(disc) && disc > 0 ? disc : 0;
  const t = Number.isFinite(tax) && tax > 0 ? tax : 0;
  return Math.round((linesSum - d + t) * 100) / 100;
}

export function colorSplitsQty(splits: GrnColorSplit[] | undefined) {
  if (!splits?.length) return 0;
  return splits.reduce((sum, s) => {
    const n = Number(s.quantity);
    return sum + (Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0);
  }, 0);
}
