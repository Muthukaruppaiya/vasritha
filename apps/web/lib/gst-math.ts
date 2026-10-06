export type GstMoneySplit = {
  taxable: number;
  gst: number;
  cgst: number;
  sgst: number;
  igst: number;
};

/** Allowed GST % for catalogue / POS (matches product form). Client-safe. */
export const ALLOWED_GST_RATES = [0, 3, 5, 9, 12, 18] as const;

/**
 * Readymade garments — HSN Chapters 61 (knitted/crocheted) & 62 (woven).
 * GST on sale value per piece: 5% up to ₹2,500; 18% above ₹2,500.
 */
export const GARMENT_HSN_CHAPTERS = ["61", "62"] as const;
export const GARMENT_SALE_VALUE_THRESHOLD = 2500;
export const COMMON_GARMENT_HSN = [
  { code: "6109", label: "T-shirts (knitted)" },
  { code: "6105", label: "Knitted shirts" },
  { code: "6205", label: "Men's woven shirts" },
  { code: "6204", label: "Women's woven apparel" },
  { code: "6211", label: "Track suits / other woven" }
] as const;

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Normalize HSN/SAC to digits only (4–8). Client-safe. */
export function normalizeHsn(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 4 || digits.length > 8) return null;
  return digits;
}

/** True when HSN starts with chapter 61 or 62 (readymade garments). */
export function isReadymadeGarmentHsn(hsn: unknown): boolean {
  const digits = String(hsn ?? "").replace(/\D/g, "");
  if (digits.length < 2) return false;
  const chapter = digits.slice(0, 2);
  return (GARMENT_HSN_CHAPTERS as readonly string[]).includes(chapter);
}

/** Garment GST slab from per-piece sale value (not invoice total). */
export function garmentGstRateForSaleValue(saleValuePerPiece: unknown): 5 | 18 {
  const n = Number(saleValuePerPiece);
  if (Number.isFinite(n) && n > GARMENT_SALE_VALUE_THRESHOLD) return 18;
  return 5;
}

/**
 * Resolve GST % for a sale/catalogue line.
 * Chapters 61/62 always use the ₹2,500 garment slab on per-piece sale value.
 */
export function resolveSaleGstRate(input: {
  hsnCode?: string | null;
  saleValuePerPiece: unknown;
  fallbackRate?: unknown;
}): number {
  if (isReadymadeGarmentHsn(input.hsnCode)) {
    return garmentGstRateForSaleValue(input.saleValuePerPiece);
  }
  return normalizeGstRate(input.fallbackRate, 5);
}

/** First 2 digits of GSTIN = state code. Client-safe. */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  const raw = String(gstin || "")
    .trim()
    .toUpperCase();
  if (raw.length < 2) return null;
  const code = raw.slice(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

export function normalizeGstRate(value: unknown, fallback = 5): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback;
  const rounded = round2(n);
  if ((ALLOWED_GST_RATES as readonly number[]).includes(rounded)) return rounded;
  let best = fallback;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const rate of ALLOWED_GST_RATES) {
    const dist = Math.abs(rate - rounded);
    if (dist < bestDist) {
      bestDist = dist;
      best = rate;
    }
  }
  return best;
}

/** Split GST-inclusive amount into taxable + tax (half CGST/SGST for intra-state). */
export function splitInclusiveGst(amountInclusive: number, ratePercent: number): GstMoneySplit {
  const amount = Math.max(0, Number(amountInclusive) || 0);
  const rate = Math.max(0, Number(ratePercent) || 0);
  if (rate <= 0 || amount <= 0) {
    return { taxable: round2(amount), gst: 0, cgst: 0, sgst: 0, igst: 0 };
  }
  const taxable = round2(amount / (1 + rate / 100));
  const gst = round2(amount - taxable);
  const half = round2(gst / 2);
  return { taxable, gst, cgst: half, sgst: round2(gst - half), igst: 0 };
}
