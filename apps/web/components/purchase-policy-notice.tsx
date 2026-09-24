"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  buildPurchasePolicySummary,
  type ExchangePolicySettings,
  type PurchasePolicySummary
} from "../lib/purchase-policy-display";

type Props = {
  /** Server-provided settings (product page). When omitted, loads from /api/exchange/policy. */
  settings?: ExchangePolicySettings | null;
  /** Pre-built summary — preferred when settings already summarized server-side. */
  summary?: PurchasePolicySummary | null;
  variant?: "detail" | "compact";
};

let cachedSummary: PurchasePolicySummary | null = null;

async function fetchSummary(): Promise<PurchasePolicySummary | null> {
  if (cachedSummary) return cachedSummary;
  try {
    const res = await fetch("/api/exchange/policy", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: ExchangePolicySettings & { summary?: PurchasePolicySummary };
    };
    const data = json.data;
    if (!data) return null;
    cachedSummary = data.summary || buildPurchasePolicySummary(data);
    return cachedSummary;
  } catch {
    return null;
  }
}

export function PurchasePolicyNotice({
  settings = null,
  summary: summaryProp = null,
  variant = "detail"
}: Props) {
  const [summary, setSummary] = useState<PurchasePolicySummary | null>(
    () => summaryProp || (settings ? buildPurchasePolicySummary(settings) : null)
  );

  useEffect(() => {
    if (summaryProp) {
      setSummary(summaryProp);
      return;
    }
    if (settings) {
      setSummary(buildPurchasePolicySummary(settings));
      return;
    }
    let cancelled = false;
    void fetchSummary().then((s) => {
      if (!cancelled && s) setSummary(s);
    });
    return () => {
      cancelled = true;
    };
  }, [summaryProp, settings]);

  if (!summary) return null;

  if (variant === "compact") {
    return (
      <div className="purchase-policy purchase-policy--compact" role="note">
        <p>
          <strong>{summary.no_refund ? "NO REFUND" : "Policy"}</strong>
          {" · "}
          {summary.online_summary.replace(/^Online orders:\s*/i, "")}
        </p>
        {summary.in_store_only ? (
          <p className="purchase-policy-instore muted">{summary.in_store_text}</p>
        ) : null}
        <p className="purchase-policy-links">
          <Link href="/exchange-policy">Exchange policy</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/shipping-policy">Shipping</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="purchase-policy purchase-policy--detail" role="region" aria-label="Purchase policy">
      <div className="purchase-policy-head">
        <strong>{summary.no_refund_headline}</strong>
        <p>{summary.no_refund_body}</p>
      </div>

      <ul className="purchase-policy-list">
        <li>
          <span>Exchange</span>
          <strong>
            {summary.exchange_enabled
              ? summary.exchange_period_label
              : "Temporarily unavailable — contact the boutique"}
          </strong>
        </li>
        <li>
          <span>Condition</span>
          <strong>{summary.condition_text}</strong>
        </li>
        <li>
          <span>Not eligible</span>
          <strong>{summary.non_eligible_text}</strong>
        </li>
        {summary.in_store_only ? (
          <li>
            <span>In-store purchases</span>
            <strong>{summary.in_store_text}</strong>
          </li>
        ) : null}
      </ul>

      {summary.notes ? <p className="purchase-policy-notes muted">{summary.notes}</p> : null}

      <p className="purchase-policy-links">
        <Link href="/exchange-policy">Full exchange policy</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/shipping-policy">Shipping policy</Link>
      </p>
    </div>
  );
}
