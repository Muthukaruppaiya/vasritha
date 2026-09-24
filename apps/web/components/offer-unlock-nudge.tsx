"use client";

import { formatPrice } from "../lib/cart";

export type OfferProgressView = {
  unlocked: boolean;
  minOrderAmount: number;
  currentAmount: number;
  remainingAmount: number;
  progressPercent: number;
  estimatedDiscount: number | null;
  benefitLabel: string;
  code?: string;
  source?: string;
};

type Props = {
  progress: OfferProgressView;
  /** i18n: “Add ₹{amount} more to unlock the offer” */
  lockedMessage: string;
  /** i18n: “Offer unlocked” */
  unlockedMessage: string;
  /** Optional note that discount applies at payment (not cart total). */
  appliesAtPayNote?: string;
};

export function OfferUnlockNudge({
  progress,
  lockedMessage,
  unlockedMessage,
  appliesAtPayNote
}: Props) {
  if (progress.minOrderAmount <= 0) return null;

  const pct = Math.min(100, Math.max(0, progress.progressPercent));

  return (
    <div
      className={`offer-unlock${progress.unlocked ? " is-unlocked" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="offer-unlock-head">
        <strong>{progress.benefitLabel}</strong>
        {progress.code ? <span className="offer-unlock-code">{progress.code}</span> : null}
      </div>
      <div className="offer-unlock-meter" aria-hidden="true">
        <div className="offer-unlock-meter-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="offer-unlock-ratio muted">
        {formatPrice(progress.currentAmount)} / {formatPrice(progress.minOrderAmount)}
      </p>
      <p className="offer-unlock-msg">
        {progress.unlocked ? unlockedMessage : lockedMessage}
      </p>
      {progress.unlocked && progress.estimatedDiscount != null && progress.estimatedDiscount > 0 ? (
        <p className="offer-unlock-estimate muted">
          Est. save {formatPrice(progress.estimatedDiscount)}
          {appliesAtPayNote ? ` · ${appliesAtPayNote}` : ""}
        </p>
      ) : null}
    </div>
  );
}

/** Build locked copy: Add ₹X more to unlock the offer */
export function buildOfferLockedMessage(remaining: number, benefitLabel: string) {
  const amount = formatPrice(remaining);
  return `Add ${amount} more to unlock ${benefitLabel || "the offer"} 🎁`;
}
