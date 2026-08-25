const STORAGE_KEY = "vasritha-applied-coupon";
const DISMISS_KEY = "vasritha-voucher-dismissed";

export type AppliedCoupon = {
  id: string;
  code: string;
};

export function getAppliedCoupon(): AppliedCoupon | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppliedCoupon;
    if (!parsed?.code) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setAppliedCoupon(coupon: AppliedCoupon) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(coupon));
}

export function clearAppliedCoupon() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function wasVoucherDismissed(id: string) {
  if (typeof window === "undefined") return true;
  return window.sessionStorage.getItem(DISMISS_KEY) === id;
}

export function dismissVoucher(id: string) {
  window.sessionStorage.setItem(DISMISS_KEY, id);
}
