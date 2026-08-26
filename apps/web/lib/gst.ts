import { query, queryOne } from "./db/pool";

export type SellerGstProfile = {
  legal_name: string | null;
  address: string | null;
  gstin: string | null;
  state: string | null;
  state_code: string | null;
  phone: string | null;
  email: string | null;
  prices_inclusive_of_gst: boolean;
};

export type GstMoneySplit = {
  taxable: number;
  gst: number;
  cgst: number;
  sgst: number;
  igst: number;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Normalize HSN/SAC to digits only (4–8). */
export function normalizeHsn(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 4 || digits.length > 8) return null;
  return digits;
}

export function normalizeGstRate(value: unknown, fallback = 5): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback;
  return round2(n);
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

export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  const raw = String(gstin || "")
    .trim()
    .toUpperCase();
  if (raw.length < 2) return null;
  const code = raw.slice(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

export async function ensureGstSchema() {
  await query(`
    alter table public.products
      add column if not exists hsn_code text,
      add column if not exists gst_rate numeric(5,2) not null default 5
  `);
  await query(`
    alter table public.order_items
      add column if not exists hsn_code text,
      add column if not exists gst_rate numeric(5,2)
  `);
  await query(`
    alter table public.site_settings
      add column if not exists company_state text,
      add column if not exists company_state_code text,
      add column if not exists prices_inclusive_of_gst boolean not null default true
  `);
}

export async function getSellerGstProfile(): Promise<SellerGstProfile> {
  await ensureGstSchema();
  const row = await queryOne<{
    company_legal_name: string | null;
    site_name: string | null;
    company_address: string | null;
    company_gstin: string | null;
    company_state: string | null;
    company_state_code: string | null;
    support_phone: string | null;
    support_email: string | null;
    prices_inclusive_of_gst: boolean | null;
  }>(
    `select company_legal_name, site_name, company_address, company_gstin,
            company_state, company_state_code, support_phone, support_email,
            prices_inclusive_of_gst
     from site_settings
     limit 1`
  );

  const gstin = row?.company_gstin ? String(row.company_gstin).trim().toUpperCase() : null;
  const stateCode =
    (row?.company_state_code ? String(row.company_state_code).trim() : null) ||
    stateCodeFromGstin(gstin);

  return {
    legal_name: row?.company_legal_name || row?.site_name || "Vasritha",
    address: row?.company_address || null,
    gstin,
    state: row?.company_state || null,
    state_code: stateCode,
    phone: row?.support_phone || null,
    email: row?.support_email || null,
    prices_inclusive_of_gst: row?.prices_inclusive_of_gst !== false
  };
}

/** Summarise GST for bill lines (amounts are GST-inclusive). */
export function summariseInclusiveLines(
  lines: Array<{ line_total: number; gst_rate: number }>,
  discountAmount = 0,
  interState = false
) {
  const subtotal = round2(lines.reduce((sum, line) => sum + Number(line.line_total || 0), 0));
  const discount = Math.min(subtotal, Math.max(0, round2(discountAmount)));
  const payable = round2(Math.max(0, subtotal - discount));

  let taxable = 0;
  let gst = 0;

  for (const line of lines) {
    const share = subtotal > 0 ? Number(line.line_total || 0) / subtotal : 0;
    const net = round2(payable * share);
    const split = splitInclusiveGst(net, line.gst_rate);
    taxable = round2(taxable + split.taxable);
    gst = round2(gst + split.gst);
  }

  // Fix rounding drift against payable
  const drift = round2(payable - (taxable + gst));
  if (drift !== 0) gst = round2(gst + drift);

  if (interState) {
    return {
      taxable,
      gst,
      cgst: 0,
      sgst: 0,
      igst: gst,
      payable
    };
  }

  const cgst = round2(gst / 2);
  return {
    taxable,
    gst,
    cgst,
    sgst: round2(gst - cgst),
    igst: 0,
    payable
  };
}
