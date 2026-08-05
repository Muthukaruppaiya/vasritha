"use client";

import { LocaleProvider } from "../lib/i18n/provider";

export function StorefrontI18n({ children }: { children: React.ReactNode }) {
  return <LocaleProvider>{children}</LocaleProvider>;
}
