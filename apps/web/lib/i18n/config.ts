export const LOCALES = ["en", "ta", "ml", "kn", "hi", "pa", "gu"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_STORAGE_KEY = "vasritha-locale";

export const LOCALE_META: Record<
  Locale,
  { label: string; nativeLabel: string; htmlLang: string }
> = {
  en: { label: "English", nativeLabel: "English", htmlLang: "en" },
  ta: { label: "Tamil", nativeLabel: "தமிழ்", htmlLang: "ta" },
  ml: { label: "Malayalam", nativeLabel: "മലയാളം", htmlLang: "ml" },
  kn: { label: "Kannada", nativeLabel: "ಕನ್ನಡ", htmlLang: "kn" },
  hi: { label: "Hindi", nativeLabel: "हिन्दी", htmlLang: "hi" },
  pa: { label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", htmlLang: "pa" },
  gu: { label: "Gujarati", nativeLabel: "ગુજરાતી", htmlLang: "gu" }
};

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
