import { query, queryOne } from "./db/pool";
import { ensureShopsSchema } from "./shops";
import { round2, splitInclusiveGst, type GstMoneySplit } from "./gst-math";

export type { GstMoneySplit } from "./gst-math";
export { round2, splitInclusiveGst } from "./gst-math";

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

export type SellerGstProfile = {
  legal_name: string | null;
  address: string | null;
  gstin: string | null;
  state: string | null;
  state_code: string | null;
  phone: string | null;
  email: string | null;
  prices_inclusive_of_gst: boolean;
  shop_id?: string | null;
  shop_name?: string | null;
  shop_code?: string | null;
};

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

export async function getSellerGstProfile(shopId?: string | null): Promise<SellerGstProfile> {
  await ensureGstSchema();
  await ensureShopsSchema();
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

  let shop: {
    id: string;
    code: string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    state: string | null;
    state_code: string | null;
    gstin: string | null;
  } | null = null;

  if (shopId) {
    shop = await queryOne(
      `select id, code, name, address, phone, email, state, state_code, gstin
       from shops where id = $1`,
      [shopId]
    );
  }
  if (!shop) {
    shop = await queryOne(
      `select id, code, name, address, phone, email, state, state_code, gstin
       from shops
       where is_default = true and is_active = true
       limit 1`
    );
  }

  const gstinRaw = shop?.gstin || row?.company_gstin;
  const gstin = gstinRaw ? String(gstinRaw).trim().toUpperCase() : null;
  const stateCode =
    (shop?.state_code ? String(shop.state_code).trim() : null) ||
    (row?.company_state_code ? String(row.company_state_code).trim() : null) ||
    stateCodeFromGstin(gstin);

  return {
    legal_name: shop?.name || row?.company_legal_name || row?.site_name || "Vasritha",
    address: shop?.address || row?.company_address || null,
    gstin,
    state: shop?.state || row?.company_state || null,
    state_code: stateCode,
    phone: shop?.phone || row?.support_phone || null,
    email: shop?.email || row?.support_email || null,
    prices_inclusive_of_gst: row?.prices_inclusive_of_gst !== false,
    shop_id: shop?.id || null,
    shop_name: shop?.name || null,
    shop_code: shop?.code || null
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
