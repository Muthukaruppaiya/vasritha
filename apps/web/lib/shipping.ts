import { ensureCategoriesSchema } from "./catalog";
import { query, queryOne } from "./db/pool";
import { skipRuntimeSchemaEnsure } from "./schema-bootstrap";

export type CategoryShippingCombineMode = "max" | "sum";

export type ShippingSettings = {
  free_shipping_min: number;
  default_shipping_fee: number;
  delivery_enabled: boolean;
  estimated_delivery_text: string | null;
  order_processing_text: string | null;
  shipping_policy_notes: string | null;
  delivery_pincode_mode: "all" | "allowlist" | "blocklist";
  delivery_pincodes: string;
  /**
   * How to combine multiple category rates in one cart.
   * No prior business rule existed — admin-configurable.
   * - max: single shipment fee = highest active category rate (default)
   * - sum: add each distinct category's rate
   */
  category_shipping_combine_mode: CategoryShippingCombineMode;
};

export type CategoryShippingFee = {
  category_id: string;
  category_name: string;
  charge: number;
  is_free: boolean;
};

export type ShippingQuote = {
  delivery_available: boolean;
  delivery_message: string;
  shipping_amount: number;
  free_shipping: boolean;
  free_shipping_min: number;
  default_shipping_fee: number;
  remaining_for_free: number;
  progress_percent: number;
  estimated_delivery_text: string | null;
  subtotal: number;
  category_shipping_combine_mode: CategoryShippingCombineMode;
  category_fees: CategoryShippingFee[];
  /** Fee before free-shipping threshold / delivery block. */
  category_base_amount: number;
  used_default_flat: boolean;
};

let schemaReady = false;

export async function ensureShippingSchema() {
  if (schemaReady || skipRuntimeSchemaEnsure()) {
    schemaReady = true;
    return;
  }
  await query(`
    alter table public.site_settings
      add column if not exists default_shipping_fee numeric(12,2) not null default 0,
      add column if not exists delivery_enabled boolean not null default true,
      add column if not exists estimated_delivery_text text,
      add column if not exists order_processing_text text,
      add column if not exists shipping_policy_notes text,
      add column if not exists delivery_pincode_mode text not null default 'all',
      add column if not exists delivery_pincodes text not null default '',
      add column if not exists category_shipping_combine_mode text not null default 'max'
  `);
  await query(`
    update public.site_settings
    set estimated_delivery_text = coalesce(nullif(estimated_delivery_text, ''), '3–7 business days across India'),
        order_processing_text = coalesce(nullif(order_processing_text, ''), 'Orders are packed within 1–2 business days after payment confirmation'),
        category_shipping_combine_mode = coalesce(nullif(category_shipping_combine_mode, ''), 'max')
    where true
  `);
  await ensureCategoriesSchema();
  schemaReady = true;
}

function parsePincodeList(raw: string) {
  return new Set(
    String(raw || "")
      .split(/[\s,;]+/)
      .map((p) => p.trim())
      .filter((p) => /^\d{4,6}$/.test(p))
  );
}

function normalizePincode(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "");
}

export async function getShippingSettings(): Promise<ShippingSettings> {
  await ensureShippingSchema();
  const row = await queryOne<{
    free_shipping_min: string | number | null;
    default_shipping_fee: string | number | null;
    delivery_enabled: boolean | null;
    estimated_delivery_text: string | null;
    order_processing_text: string | null;
    shipping_policy_notes: string | null;
    delivery_pincode_mode: string | null;
    delivery_pincodes: string | null;
    category_shipping_combine_mode: string | null;
  }>(
    `select free_shipping_min,
            coalesce(default_shipping_fee, 0) as default_shipping_fee,
            coalesce(delivery_enabled, true) as delivery_enabled,
            estimated_delivery_text,
            order_processing_text,
            shipping_policy_notes,
            coalesce(delivery_pincode_mode, 'all') as delivery_pincode_mode,
            coalesce(delivery_pincodes, '') as delivery_pincodes,
            coalesce(category_shipping_combine_mode, 'max') as category_shipping_combine_mode
     from site_settings
     limit 1`
  );

  const modeRaw = String(row?.delivery_pincode_mode || "all").toLowerCase();
  const mode: ShippingSettings["delivery_pincode_mode"] =
    modeRaw === "allowlist" || modeRaw === "blocklist" ? modeRaw : "all";

  const combineRaw = String(row?.category_shipping_combine_mode || "max").toLowerCase();
  const combine: CategoryShippingCombineMode = combineRaw === "sum" ? "sum" : "max";

  return {
    free_shipping_min: Math.max(0, Number(row?.free_shipping_min || 0)),
    default_shipping_fee: Math.max(0, Number(row?.default_shipping_fee || 0)),
    delivery_enabled: row?.delivery_enabled !== false,
    estimated_delivery_text: row?.estimated_delivery_text || null,
    order_processing_text: row?.order_processing_text || null,
    shipping_policy_notes: row?.shipping_policy_notes || null,
    delivery_pincode_mode: mode,
    delivery_pincodes: String(row?.delivery_pincodes || ""),
    category_shipping_combine_mode: combine
  };
}

export function checkDeliveryAvailability(
  settings: ShippingSettings,
  postalCode?: string | null
): { available: boolean; message: string } {
  if (!settings.delivery_enabled) {
    return {
      available: false,
      message:
        "Online delivery is temporarily unavailable. Please visit the boutique or try again later."
    };
  }

  const pin = normalizePincode(postalCode);
  if (!pin) {
    return {
      available: true,
      message: "Enter a delivery address at checkout to confirm serviceability."
    };
  }

  if (!/^\d{4,6}$/.test(pin)) {
    return {
      available: false,
      message: "Enter a valid PIN code to check delivery."
    };
  }

  const list = parsePincodeList(settings.delivery_pincodes);
  if (settings.delivery_pincode_mode === "allowlist") {
    if (list.size === 0) {
      return {
        available: false,
        message: "Delivery areas are being configured. Please contact the boutique."
      };
    }
    if (!list.has(pin)) {
      return {
        available: false,
        message: `Sorry, we do not deliver to PIN ${pin} yet.`
      };
    }
  }
  if (settings.delivery_pincode_mode === "blocklist" && list.has(pin)) {
    return {
      available: false,
      message: `Sorry, we do not deliver to PIN ${pin}.`
    };
  }

  return {
    available: true,
    message: "Delivery is available for your address."
  };
}

export function combineCategoryShippingCharges(
  fees: CategoryShippingFee[],
  mode: CategoryShippingCombineMode,
  fallbackFlat: number
): { amount: number; used_default_flat: boolean } {
  if (!fees.length) {
    return { amount: Math.max(0, fallbackFlat), used_default_flat: true };
  }
  const charges = fees.map((f) => Math.max(0, Number(f.charge) || 0));
  if (mode === "sum") {
    return {
      amount: Number(charges.reduce((sum, n) => sum + n, 0).toFixed(2)),
      used_default_flat: false
    };
  }
  return {
    amount: Number(Math.max(...charges, 0).toFixed(2)),
    used_default_flat: false
  };
}

/** Load active category shipping rates for products in the cart (one rate per category). */
export async function loadCategoryShippingFees(input: {
  productIds?: string[] | null;
  categoryIds?: string[] | null;
}): Promise<{ fees: CategoryShippingFee[]; uncovered_category_count: number }> {
  await ensureCategoriesSchema();

  const productIds = Array.from(
    new Set((input.productIds || []).map((id) => String(id || "").trim()).filter(Boolean))
  );
  const categoryIds = Array.from(
    new Set((input.categoryIds || []).map((id) => String(id || "").trim()).filter(Boolean))
  );

  if (!productIds.length && !categoryIds.length) {
    return { fees: [], uncovered_category_count: 0 };
  }

  type CatRow = {
    category_id: string;
    category_name: string;
    shipping_charge: string | number | null;
    shipping_is_free: boolean | null;
    shipping_rate_active: boolean | null;
  };

  let rows: CatRow[] = [];

  if (productIds.length) {
    rows = await query(
      `select distinct on (c.id)
              c.id as category_id,
              c.name as category_name,
              c.shipping_charge,
              c.shipping_is_free,
              c.shipping_rate_active
       from products p
       join categories c on c.id = p.category_id
       where p.id = any($1::uuid[])
       order by c.id`,
      [productIds]
    );
  } else {
    rows = await query(
      `select c.id as category_id,
              c.name as category_name,
              c.shipping_charge,
              c.shipping_is_free,
              c.shipping_rate_active
       from categories c
       where c.id = any($1::uuid[])
       order by c.name asc`,
      [categoryIds]
    );
  }

  const fees: CategoryShippingFee[] = [];
  let uncovered = 0;
  for (const row of rows) {
    if (row.shipping_rate_active !== true) {
      uncovered += 1;
      continue;
    }
    const isFree = row.shipping_is_free === true;
    fees.push({
      category_id: row.category_id,
      category_name: row.category_name,
      charge: isFree ? 0 : Math.max(0, Number(row.shipping_charge || 0)),
      is_free: isFree
    });
  }

  return { fees, uncovered_category_count: uncovered };
}

/** Authoritative shipping quote — used by quote API and order create. */
export function computeShippingQuote(input: {
  subtotal: number;
  settings: ShippingSettings;
  postalCode?: string | null;
  categoryFees?: CategoryShippingFee[];
  uncoveredCategoryCount?: number;
}): ShippingQuote {
  const subtotal = Math.max(0, Number(input.subtotal) || 0);
  const eligibility = checkDeliveryAvailability(input.settings, input.postalCode);
  const freeMin = input.settings.free_shipping_min;
  const flatFee = input.settings.default_shipping_fee;
  const freeShipping = freeMin > 0 && subtotal >= freeMin;
  const remaining = freeMin > 0 ? Math.max(0, Math.ceil(freeMin - subtotal)) : 0;
  const progress =
    freeMin <= 0
      ? freeShipping || flatFee <= 0
        ? 100
        : 0
      : Math.min(100, Math.round((subtotal / freeMin) * 100));

  const realFees = [...(input.categoryFees || [])];
  const uncovered = Math.max(0, Number(input.uncoveredCategoryCount || 0));

  const feesForCombine = [...realFees];
  // Categories without an active rate fall back to the default flat fee (once).
  if (uncovered > 0) {
    feesForCombine.push({
      category_id: "__default__",
      category_name: "Standard delivery",
      charge: Math.max(0, flatFee),
      is_free: flatFee <= 0
    });
  }

  const combined = combineCategoryShippingCharges(
    feesForCombine,
    input.settings.category_shipping_combine_mode,
    flatFee
  );

  let shippingAmount = 0;
  if (eligibility.available) {
    shippingAmount = freeShipping ? 0 : combined.amount;
  }

  return {
    delivery_available: eligibility.available,
    delivery_message: eligibility.message,
    shipping_amount: Number(shippingAmount.toFixed(2)),
    free_shipping: freeShipping && eligibility.available,
    free_shipping_min: freeMin,
    default_shipping_fee: flatFee,
    remaining_for_free: remaining,
    progress_percent: progress,
    estimated_delivery_text: input.settings.estimated_delivery_text,
    subtotal: Number(subtotal.toFixed(2)),
    category_shipping_combine_mode: input.settings.category_shipping_combine_mode,
    category_fees: realFees,
    category_base_amount: combined.amount,
    used_default_flat: realFees.length === 0
  };
}

export async function quoteShipping(input: {
  subtotal: number;
  postalCode?: string | null;
  productIds?: string[] | null;
  categoryIds?: string[] | null;
}): Promise<ShippingQuote> {
  const settings = await getShippingSettings();
  const loaded = await loadCategoryShippingFees({
    productIds: input.productIds,
    categoryIds: input.categoryIds
  });
  return computeShippingQuote({
    subtotal: input.subtotal,
    settings,
    postalCode: input.postalCode,
    categoryFees: loaded.fees,
    uncoveredCategoryCount: loaded.uncovered_category_count
  });
}
