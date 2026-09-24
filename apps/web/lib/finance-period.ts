/** Indian FY and common finance date presets (dynamic). */

export type FinancePeriodKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "previous_month"
  | "this_quarter"
  | "this_year"
  | "previous_fy"
  | "this_fy"
  | "custom";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** FY start month: 4 = April (India). */
export function financialYearBounds(asOf = new Date(), fyStartMonth = 4) {
  const y = asOf.getFullYear();
  const m = asOf.getMonth() + 1;
  const startYear = m >= fyStartMonth ? y : y - 1;
  const from = new Date(startYear, fyStartMonth - 1, 1);
  const to = new Date(startYear + 1, fyStartMonth - 1, 0); // last day of month before next FY
  return { from: iso(from), to: iso(to), startYear };
}

export function resolveFinancePeriod(
  key: FinancePeriodKey | string | null | undefined,
  opts?: { from?: string; to?: string; fyStartMonth?: number }
): { from: string; to: string; key: string } {
  const fyStart = opts?.fyStartMonth ?? 4;
  const now = startOfDay(new Date());

  if (key === "custom" || (!key && (opts?.from || opts?.to))) {
    const fy = financialYearBounds(now, fyStart);
    return {
      from: opts?.from || fy.from,
      to: opts?.to || iso(now),
      key: "custom"
    };
  }

  const k = (key || "this_month") as FinancePeriodKey;

  if (k === "today") {
    const d = iso(now);
    return { from: d, to: d, key: k };
  }
  if (k === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const d = iso(y);
    return { from: d, to: d, key: k };
  }
  if (k === "this_week") {
    const day = now.getDay() || 7; // Mon=1 … Sun=7
    const from = new Date(now);
    from.setDate(now.getDate() - (day - 1));
    return { from: iso(from), to: iso(now), key: k };
  }
  if (k === "this_month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: iso(from), to: iso(now), key: k };
  }
  if (k === "previous_month") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: iso(from), to: iso(to), key: k };
  }
  if (k === "this_quarter") {
    const q = Math.floor(now.getMonth() / 3);
    const from = new Date(now.getFullYear(), q * 3, 1);
    return { from: iso(from), to: iso(now), key: k };
  }
  if (k === "this_year") {
    const from = new Date(now.getFullYear(), 0, 1);
    return { from: iso(from), to: iso(now), key: k };
  }
  if (k === "this_fy") {
    const fy = financialYearBounds(now, fyStart);
    return { from: fy.from, to: iso(now), key: k };
  }
  if (k === "previous_fy") {
    const fy = financialYearBounds(now, fyStart);
    const prevTo = new Date(fy.startYear, fyStart - 1, 0);
    const prevFrom = new Date(fy.startYear - 1, fyStart - 1, 1);
    return { from: iso(prevFrom), to: iso(prevTo), key: k };
  }

  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: iso(from), to: iso(now), key: "this_month" };
}

export const PERIOD_OPTIONS: Array<{ value: FinancePeriodKey; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "previous_month", label: "Previous month" },
  { value: "this_year", label: "This year" },
  { value: "this_fy", label: "This financial year" },
  { value: "custom", label: "Custom range" }
];
