"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { LOCALES, LOCALE_META, type Locale } from "../lib/i18n/config";
import { useLocale } from "../lib/i18n/provider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (next: Locale) => {
    setLocale(next);
    setOpen(false);
  };

  return (
    <div className={`lang-switcher${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="lang-switcher-trigger"
        aria-label={t("common.chooseLanguage")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        title={t("common.language")}
        onClick={() => setOpen((v) => !v)}
      >
        <Globe size={18} strokeWidth={1.7} />
        <span className="lang-switcher-code">{locale.toUpperCase()}</span>
      </button>

      {open ? (
        <ul id={listId} className="lang-switcher-menu" role="listbox" aria-label={t("common.language")}>
          {LOCALES.map((code) => {
            const meta = LOCALE_META[code];
            const active = code === locale;
            return (
              <li key={code} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={active ? "is-active" : undefined}
                  onClick={() => choose(code)}
                >
                  <strong>{meta.nativeLabel}</strong>
                  <span>{meta.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
