/** Pure document-number formatting — safe for client components (no DB / pg). */

export type DocNumberKind = "invoice" | "grn" | "online";

export type DocNumberSettings = {
  doc_prefix_invoice: string;
  doc_prefix_grn: string;
  doc_prefix_online: string;
  doc_number_pad: number;
  doc_number_year_mode: "calendar" | "fy";
};

export const DOC_NUMBER_DEFAULTS: DocNumberSettings = {
  doc_prefix_invoice: "VAS",
  doc_prefix_grn: "GRN",
  doc_prefix_online: "VAS",
  doc_number_pad: 3,
  doc_number_year_mode: "calendar"
};

export function sanitizeDocPrefix(raw: string | null | undefined, fallback: string) {
  const cleaned = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  return cleaned || fallback;
}

export function sanitizeDocPad(raw: unknown) {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n)) return DOC_NUMBER_DEFAULTS.doc_number_pad;
  return Math.min(8, Math.max(2, n));
}

export function resolveDocYearKey(
  mode: "calendar" | "fy",
  now = new Date(),
  fyStartMonth = 4
): string {
  if (mode !== "fy") return String(now.getFullYear());
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const start = Math.min(12, Math.max(1, Math.trunc(fyStartMonth) || 4));
  // Indian FY: Apr–Mar → year key is the FY starting calendar year.
  return String(month >= start ? year : year - 1);
}

export function buildDocumentNumber(prefix: string, yearKey: string, seq: number, pad: number) {
  const safePad = sanitizeDocPad(pad);
  const safePrefix = sanitizeDocPrefix(prefix, "DOC");
  return `${safePrefix}${yearKey}-${String(Math.max(1, seq)).padStart(safePad, "0")}`;
}

export function previewDocumentNumber(
  settings: Partial<DocNumberSettings>,
  kind: DocNumberKind,
  seq = 1,
  now = new Date()
) {
  const prefix =
    kind === "grn"
      ? sanitizeDocPrefix(settings.doc_prefix_grn, DOC_NUMBER_DEFAULTS.doc_prefix_grn)
      : kind === "online"
        ? sanitizeDocPrefix(settings.doc_prefix_online, DOC_NUMBER_DEFAULTS.doc_prefix_online)
        : sanitizeDocPrefix(settings.doc_prefix_invoice, DOC_NUMBER_DEFAULTS.doc_prefix_invoice);
  const mode = settings.doc_number_year_mode === "fy" ? "fy" : "calendar";
  const yearKey = resolveDocYearKey(mode, now);
  return buildDocumentNumber(prefix, yearKey, seq, sanitizeDocPad(settings.doc_number_pad));
}
