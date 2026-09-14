export type GrnDraftLine = {
  productVariantId: string;
  quantity: string;
  purchasePrice: string;
  /** Free-text search hint when SKU was missing */
  searchHint?: string;
};

export type GrnDraft = {
  supplierId: string;
  /** Legacy free-text kept for older drafts */
  supplier: string;
  billNo: string;
  invoiceAmount: string;
  note: string;
  lines: GrnDraftLine[];
  /** Which line index to fill after creating a product */
  focusLineIndex: number;
  savedAt: string;
};

const STORAGE_KEY = "vasritha_grn_draft_v1";

export function blankGrnDraft(variantId = ""): GrnDraft {
  return {
    supplierId: "",
    supplier: "",
    billNo: "",
    invoiceAmount: "",
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
    const parsed = JSON.parse(raw) as GrnDraft;
    if (!parsed || !Array.isArray(parsed.lines) || !parsed.lines.length) return null;
    return {
      supplierId: String((parsed as GrnDraft).supplierId || ""),
      supplier: String(parsed.supplier || ""),
      billNo: String(parsed.billNo || ""),
      invoiceAmount: String(parsed.invoiceAmount || ""),
      note: String(parsed.note || ""),
      focusLineIndex: Number.isFinite(parsed.focusLineIndex) ? Number(parsed.focusLineIndex) : 0,
      savedAt: parsed.savedAt || new Date().toISOString(),
      lines: parsed.lines.map((line) => ({
        productVariantId: String(line.productVariantId || ""),
        quantity: String(line.quantity || "1"),
        purchasePrice: String(line.purchasePrice || ""),
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

export function lineTotal(quantity: string | number, purchasePrice: string | number) {
  const qty = Number(quantity);
  const price = Number(purchasePrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price < 0) return 0;
  return Math.round(qty * price * 100) / 100;
}

export function draftLinesTotal(lines: GrnDraftLine[]) {
  return lines.reduce((sum, line) => sum + lineTotal(line.quantity, line.purchasePrice), 0);
}
