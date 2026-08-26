const APPLIED_KEY = "vasritha-applied-coupon";
const WALLET_KEY = "vasritha-voucher-wallet";
const OPENING_SEEN_KEY = "vasritha-opening-vouchers-seen";

export const COUPON_EVENT = "vasritha:coupon";

export type AppliedCoupon = {
  id: string;
  code: string;
};

export type SavedVoucher = {
  id: string;
  code: string;
  headline?: string;
  status: "available" | "used";
  claimedAt: string;
  usedAt?: string;
};

function emitCouponChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COUPON_EVENT));
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getAppliedCoupon(): AppliedCoupon | null {
  const parsed = readJson<AppliedCoupon | null>(APPLIED_KEY, null);
  if (!parsed?.code || !parsed?.id) return null;
  const wallet = getSavedVouchers();
  const row = wallet.find((item) => item.id === parsed.id);
  if (row?.status === "used") {
    window.localStorage.removeItem(APPLIED_KEY);
    return null;
  }
  return parsed;
}

export function setAppliedCoupon(coupon: AppliedCoupon) {
  writeJson(APPLIED_KEY, coupon);
  emitCouponChange();
}

export function clearAppliedCoupon() {
  window.localStorage.removeItem(APPLIED_KEY);
  emitCouponChange();
}

export function getSavedVouchers(): SavedVoucher[] {
  const rows = readJson<SavedVoucher[]>(WALLET_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function getAvailableVouchers(): SavedVoucher[] {
  return getSavedVouchers().filter((row) => row.status === "available");
}

function markOpeningSeen(id: string) {
  const seen = readJson<string[]>(OPENING_SEEN_KEY, []);
  if (!seen.includes(id)) {
    writeJson(OPENING_SEEN_KEY, [...seen, id]);
  }
}

/** True when this opening voucher must never popup again for this browser. */
export function wasVoucherDismissed(id: string) {
  if (typeof window === "undefined") return true;
  const seen = readJson<string[]>(OPENING_SEEN_KEY, []);
  if (seen.includes(id)) return true;
  const wallet = getSavedVouchers();
  return wallet.some((row) => row.id === id);
}

/** Close without claiming — still never show this opening voucher again. */
export function dismissVoucher(id: string) {
  markOpeningSeen(id);
}

/** Scratch claim: save to voucher menu + apply for checkout + never show popup again. */
export function claimOpeningVoucher(input: {
  id: string;
  code: string;
  headline?: string;
}) {
  markOpeningSeen(input.id);
  const wallet = getSavedVouchers();
  const existing = wallet.find((row) => row.id === input.id);
  if (existing) {
    if (existing.status === "used") {
      emitCouponChange();
      return existing;
    }
    const next = wallet.map((row) =>
      row.id === input.id
        ? { ...row, code: input.code, headline: input.headline || row.headline, status: "available" as const }
        : row
    );
    writeJson(WALLET_KEY, next);
  } else {
    const row: SavedVoucher = {
      id: input.id,
      code: input.code,
      headline: input.headline,
      status: "available",
      claimedAt: new Date().toISOString()
    };
    writeJson(WALLET_KEY, [row, ...wallet]);
  }
  setAppliedCoupon({ id: input.id, code: input.code });
  return getSavedVouchers().find((row) => row.id === input.id) || null;
}

export function applySavedVoucher(id: string) {
  const row = getSavedVouchers().find((item) => item.id === id && item.status === "available");
  if (!row) return false;
  setAppliedCoupon({ id: row.id, code: row.code });
  return true;
}

/** After successful checkout payment with this code. */
export function markVoucherUsed(codeOrId: string) {
  const wallet = getSavedVouchers();
  let changed = false;
  const next = wallet.map((row) => {
    if (row.id !== codeOrId && row.code !== codeOrId) return row;
    if (row.status === "used") return row;
    changed = true;
    return { ...row, status: "used" as const, usedAt: new Date().toISOString() };
  });
  if (changed) writeJson(WALLET_KEY, next);

  const applied = getAppliedCoupon();
  if (applied && (applied.id === codeOrId || applied.code === codeOrId)) {
    window.localStorage.removeItem(APPLIED_KEY);
  }
  if (changed || applied) emitCouponChange();
}
