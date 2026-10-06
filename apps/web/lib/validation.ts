/**
 * Shared field validation for admin / POS / APIs.
 * Indian retail defaults: 10-digit mobile, GSTIN, HSN, PIN.
 */

export function digitsOnly(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

/** Last 10 digits (strips +91 / 0 prefix noise). */
export function normalizePhone10(value: unknown): string {
  const digits = digitsOnly(value);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

/** Indian mobile: exactly 10 digits, starts with 6–9. Empty allowed when optional. */
export function isValidPhone10(value: unknown, opts?: { required?: boolean }): boolean {
  const phone = normalizePhone10(value);
  if (!phone) return !opts?.required;
  return /^[6-9]\d{9}$/.test(phone);
}

export function validatePhone10(
  value: unknown,
  opts?: { required?: boolean; label?: string }
): string | null {
  const label = opts?.label || "Phone";
  const phone = normalizePhone10(value);
  if (!phone) {
    return opts?.required ? `${label} is required (10 digits)` : null;
  }
  if (phone.length !== 10) return `${label} must be 10 digits`;
  if (!/^[6-9]/.test(phone)) return `${label} must start with 6–9`;
  return null;
}

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidEmail(value: unknown, opts?: { required?: boolean }): boolean {
  const email = normalizeEmail(value);
  if (!email) return !opts?.required;
  return EMAIL_RE.test(email) && email.length <= 254;
}

export function validateEmail(
  value: unknown,
  opts?: { required?: boolean; label?: string }
): string | null {
  const label = opts?.label || "Email";
  const email = normalizeEmail(value);
  if (!email) return opts?.required ? `${label} is required` : null;
  if (!EMAIL_RE.test(email) || email.length > 254) return `Enter a valid ${label.toLowerCase()}`;
  return null;
}

export function validateRequired(value: unknown, label: string): string | null {
  if (String(value ?? "").trim()) return null;
  return `${label} is required`;
}

export function validatePassword(
  value: unknown,
  opts?: { required?: boolean; minLength?: number }
): string | null {
  const pwd = String(value ?? "");
  const min = opts?.minLength ?? 6;
  if (!pwd) return opts?.required ? `Password is required (min ${min} characters)` : null;
  if (pwd.length < min) return `Password must be at least ${min} characters`;
  return null;
}

export function validatePincode(value: unknown, opts?: { required?: boolean }): string | null {
  const pin = digitsOnly(value);
  if (!pin) return opts?.required ? "PIN code is required" : null;
  if (!/^\d{6}$/.test(pin)) return "PIN code must be 6 digits";
  return null;
}

export function validatePan(value: unknown, opts?: { required?: boolean }): string | null {
  const pan = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!pan) return opts?.required ? "PAN is required" : null;
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return "Enter a valid PAN (e.g. ABCDE1234F)";
  return null;
}

/** Indian GSTIN: 15 chars. Client-safe (do not import from lib/suppliers in browser). */
export function validateGstin(value: unknown, opts?: { required?: boolean }): string | null {
  const gstin = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!gstin) return opts?.required ? "GSTIN is required" : null;
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    return "Enter a valid 15-character GSTIN";
  }
  return null;
}

/** HSN/SAC: 4–8 digits when provided. */
export function validateHsn(value: unknown, opts?: { required?: boolean }): string | null {
  const hsn = digitsOnly(value);
  if (!hsn) return opts?.required ? "HSN is required" : null;
  if (hsn.length < 4 || hsn.length > 8) return "HSN must be 4–8 digits";
  return null;
}

export function validatePositiveMoney(
  value: unknown,
  opts?: { required?: boolean; label?: string; allowZero?: boolean }
): string | null {
  const label = opts?.label || "Amount";
  const raw = String(value ?? "").trim();
  if (!raw) return opts?.required ? `${label} is required` : null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return `${label} must be a number`;
  if (opts?.allowZero ? n < 0 : n <= 0) {
    return opts?.allowZero ? `${label} cannot be negative` : `${label} must be greater than 0`;
  }
  return null;
}

/** First non-null error from a list of checks. */
export function firstError(...errors: Array<string | null | undefined>): string | null {
  for (const err of errors) {
    if (err) return err;
  }
  return null;
}
