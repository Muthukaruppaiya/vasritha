import { LOCALES, type Locale } from "./config";
import { predefinedNamesFor } from "./predefined-categories";

export type CategoryNameI18n = Partial<Record<Locale, string>>;

export function sanitizeCategoryNameI18n(input: unknown): CategoryNameI18n {
  const out: CategoryNameI18n = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  const record = input as Record<string, unknown>;
  for (const locale of LOCALES) {
    const value = record[locale];
    if (typeof value === "string" && value.trim()) {
      out[locale] = value.trim();
    }
  }
  return out;
}

export function mergeCategoryNameI18n(input: {
  slug?: string;
  name?: string;
  nameI18n?: unknown;
}): CategoryNameI18n {
  const predefined = {
    ...predefinedNamesFor(input.slug),
    ...predefinedNamesFor(input.name)
  };
  const custom = sanitizeCategoryNameI18n(input.nameI18n);
  const merged: CategoryNameI18n = { ...predefined, ...custom };
  if (input.name?.trim()) merged.en = input.name.trim();
  return merged;
}
