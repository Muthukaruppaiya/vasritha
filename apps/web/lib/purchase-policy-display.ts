/** Pure display helpers for purchase / exchange policy (safe for client components). */

export type ExchangePolicySettings = {
  no_refund_policy: boolean;
  exchange_enabled: boolean;
  exchange_window_days: number;
  exchange_charge: number;
  exchange_condition_text: string | null;
  exchange_non_eligible_text: string | null;
  exchange_process_text: string | null;
  exchange_policy_notes: string | null;
  in_store_exchange_refund_only: boolean;
  in_store_policy_text: string | null;
};

export type PurchasePolicySummary = {
  no_refund: boolean;
  no_refund_headline: string;
  no_refund_body: string;
  exchange_enabled: boolean;
  exchange_period_label: string;
  condition_text: string;
  non_eligible_text: string;
  process_text: string;
  notes: string | null;
  in_store_only: boolean;
  in_store_text: string;
  online_summary: string;
};

export const DEFAULT_IN_STORE_POLICY_TEXT =
  "In-store purchases can be exchanged or refunded only at the physical store. Online orders follow the exchange-only (no refund) policy.";

export function buildPurchasePolicySummary(
  settings: ExchangePolicySettings
): PurchasePolicySummary {
  const exchange_period_label =
    settings.exchange_window_days > 0
      ? `Exchange within ${settings.exchange_window_days} day(s) of delivery`
      : "Exchange period confirmed by the boutique";

  const in_store_text =
    settings.in_store_policy_text?.trim() || DEFAULT_IN_STORE_POLICY_TEXT;

  const no_refund_body = settings.no_refund_policy
    ? "We do not offer cash refunds or payment reversals on online orders. Eligible products may be exchanged as per the rules below."
    : "Refund handling is configured by the boutique — please contact us for details.";

  const online_summary = settings.no_refund_policy
    ? settings.exchange_enabled
      ? `Online orders: NO REFUND · ${exchange_period_label}.`
      : "Online orders: NO REFUND · Exchanges temporarily unavailable."
    : settings.exchange_enabled
      ? `Online orders: ${exchange_period_label}.`
      : "Online exchanges are temporarily unavailable.";

  return {
    no_refund: settings.no_refund_policy,
    no_refund_headline: settings.no_refund_policy ? "NO REFUND POLICY" : "Refund policy",
    no_refund_body,
    exchange_enabled: settings.exchange_enabled,
    exchange_period_label,
    condition_text:
      settings.exchange_condition_text?.trim() ||
      "Item must be unused, unwashed, with original tags, packaging and invoice.",
    non_eligible_text:
      settings.exchange_non_eligible_text?.trim() ||
      "Sale / clearance items, custom orders, intimate apparel and jewellery marked non-exchangeable cannot be exchanged.",
    process_text:
      settings.exchange_process_text?.trim() ||
      "Request an exchange from your order page. After approval, return the piece as instructed. Once verified, we complete the exchange for an eligible product of equal or higher value (difference payable).",
    notes: settings.exchange_policy_notes?.trim() || null,
    in_store_only: settings.in_store_exchange_refund_only !== false,
    in_store_text,
    online_summary
  };
}
