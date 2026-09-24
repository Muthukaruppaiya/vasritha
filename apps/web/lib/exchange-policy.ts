import { query, queryOne } from "./db/pool";
import { skipRuntimeSchemaEnsure } from "./schema-bootstrap";
import {
  buildPurchasePolicySummary,
  DEFAULT_IN_STORE_POLICY_TEXT,
  type ExchangePolicySettings,
  type PurchasePolicySummary
} from "./purchase-policy-display";

export type { ExchangePolicySettings, PurchasePolicySummary };
export { buildPurchasePolicySummary, DEFAULT_IN_STORE_POLICY_TEXT };

let schemaReady = false;

export async function ensureExchangePolicySchema() {
  if (schemaReady || skipRuntimeSchemaEnsure()) {
    schemaReady = true;
    return;
  }

  await query(`
    alter table public.site_settings
      add column if not exists no_refund_policy boolean not null default true,
      add column if not exists exchange_enabled boolean not null default true,
      add column if not exists exchange_window_days integer not null default 7,
      add column if not exists exchange_charge numeric(12,2) not null default 0,
      add column if not exists exchange_condition_text text,
      add column if not exists exchange_non_eligible_text text,
      add column if not exists exchange_process_text text,
      add column if not exists exchange_policy_notes text,
      add column if not exists in_store_exchange_refund_only boolean not null default true,
      add column if not exists in_store_policy_text text
  `);

  await query(`
    alter table public.order_returns
      add column if not exists request_type text not null default 'exchange',
      add column if not exists admin_notes text
  `);

  // Allow exchanged status; keep historical refunded rows but new refunds blocked in API.
  await query(`
    do $$
    begin
      alter table public.order_returns drop constraint if exists order_returns_status_check;
    exception when undefined_object then
      null;
    end $$
  `);

  await query(`
    update public.site_settings
    set exchange_condition_text = coalesce(
          nullif(exchange_condition_text, ''),
          'Item must be unused, unwashed, with original tags, packaging and invoice.'
        ),
        exchange_non_eligible_text = coalesce(
          nullif(exchange_non_eligible_text, ''),
          'Sale / clearance items, custom orders, intimate apparel and jewellery marked non-exchangeable cannot be exchanged.'
        ),
        exchange_process_text = coalesce(
          nullif(exchange_process_text, ''),
          'Request an exchange from your order page. After approval, return the piece to the boutique (or as instructed). Once received and verified, we complete the exchange for an eligible product of equal or higher value (difference payable).'
        ),
        in_store_policy_text = coalesce(
          nullif(in_store_policy_text, ''),
          'In-store purchases can be exchanged or refunded only at the physical store. Online orders follow the exchange-only (no refund) policy.'
        )
    where true
  `);

  schemaReady = true;
}

export async function getExchangePolicySettings(): Promise<ExchangePolicySettings> {
  await ensureExchangePolicySchema();
  const row = await queryOne<{
    no_refund_policy: boolean | null;
    exchange_enabled: boolean | null;
    exchange_window_days: number | string | null;
    exchange_charge: string | number | null;
    exchange_condition_text: string | null;
    exchange_non_eligible_text: string | null;
    exchange_process_text: string | null;
    exchange_policy_notes: string | null;
    in_store_exchange_refund_only: boolean | null;
    in_store_policy_text: string | null;
  }>(
    `select coalesce(no_refund_policy, true) as no_refund_policy,
            coalesce(exchange_enabled, true) as exchange_enabled,
            coalesce(exchange_window_days, 7) as exchange_window_days,
            coalesce(exchange_charge, 0) as exchange_charge,
            exchange_condition_text,
            exchange_non_eligible_text,
            exchange_process_text,
            exchange_policy_notes,
            coalesce(in_store_exchange_refund_only, true) as in_store_exchange_refund_only,
            in_store_policy_text
     from site_settings
     limit 1`
  );

  return {
    no_refund_policy: row?.no_refund_policy !== false,
    exchange_enabled: row?.exchange_enabled !== false,
    exchange_window_days: Math.max(0, Number(row?.exchange_window_days || 7)),
    exchange_charge: Math.max(0, Number(row?.exchange_charge || 0)),
    exchange_condition_text: row?.exchange_condition_text || null,
    exchange_non_eligible_text: row?.exchange_non_eligible_text || null,
    exchange_process_text: row?.exchange_process_text || null,
    exchange_policy_notes: row?.exchange_policy_notes || null,
    in_store_exchange_refund_only: row?.in_store_exchange_refund_only !== false,
    in_store_policy_text: row?.in_store_policy_text || null
  };
}

export type OrderForExchange = {
  id: string;
  status: string;
  payment_status: string;
  created_at: string;
  delivered_at?: string | null;
  updated_at?: string | null;
};

/** Anchor date for the exchange window: delivered_at if known, else order date for delivered orders. */
export function exchangeAnchorDate(order: OrderForExchange): Date {
  if (order.delivered_at) return new Date(order.delivered_at);
  if (order.status === "delivered" && order.updated_at) return new Date(order.updated_at);
  return new Date(order.created_at);
}

export function evaluateExchangeEligibility(input: {
  order: OrderForExchange;
  settings: ExchangePolicySettings;
}): { eligible: boolean; reason: string; days_remaining: number | null } {
  if (!input.settings.exchange_enabled) {
    return {
      eligible: false,
      reason: "Exchanges are temporarily unavailable. Please contact the boutique.",
      days_remaining: null
    };
  }

  if (input.order.payment_status !== "paid") {
    return {
      eligible: false,
      reason: "Only paid orders can be exchanged.",
      days_remaining: null
    };
  }

  if (input.order.status === "cancelled") {
    return {
      eligible: false,
      reason: "Cancelled orders cannot be exchanged.",
      days_remaining: null
    };
  }

  if (!["delivered", "shipped", "confirmed", "processing"].includes(input.order.status)) {
    // Allow delivered primarily; also allow shipped for early requests with note
    if (input.order.status !== "delivered") {
      return {
        eligible: false,
        reason: "Exchanges open after your order is delivered.",
        days_remaining: null
      };
    }
  }

  if (input.order.status !== "delivered") {
    return {
      eligible: false,
      reason: "Exchanges open after your order is delivered.",
      days_remaining: null
    };
  }

  const windowDays = input.settings.exchange_window_days;
  if (windowDays <= 0) {
    return {
      eligible: true,
      reason: "Eligible for exchange (no time limit configured).",
      days_remaining: null
    };
  }

  const anchor = exchangeAnchorDate(input.order);
  const deadline = new Date(anchor.getTime() + windowDays * 86400000);
  const now = new Date();
  const msLeft = deadline.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / 86400000);

  if (msLeft < 0) {
    return {
      eligible: false,
      reason: `Exchange window of ${windowDays} day(s) after delivery has ended.`,
      days_remaining: 0
    };
  }

  return {
    eligible: true,
    reason: `Eligible for exchange · ${daysLeft} day(s) remaining`,
    days_remaining: daysLeft
  };
}

export const EXCHANGE_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "received",
  "exchanged"
] as const;

export type ExchangeStatus = (typeof EXCHANGE_STATUSES)[number];

export function isAllowedExchangeTransition(from: string, to: string) {
  const map: Record<string, string[]> = {
    requested: ["approved", "rejected"],
    approved: ["received", "rejected"],
    received: ["exchanged"],
    rejected: [],
    exchanged: [],
    // Legacy: do not advance refunded further
    refunded: []
  };
  return (map[from] || []).includes(to);
}
