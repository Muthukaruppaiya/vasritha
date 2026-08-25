import type { Locale } from "./config";
import type { Messages } from "./messages/en";
import { en } from "./messages/en";
import { ta } from "./messages/ta";
import { ml } from "./messages/ml";
import { kn } from "./messages/kn";
import { hi } from "./messages/hi";
import { pa } from "./messages/pa";
import { gu } from "./messages/gu";

const dictionaries: Record<Locale, Messages> = { en, ta, ml, kn, hi, pa, gu };

export type MessageKey = LeavePaths<Messages>;

type LeavePaths<T, Prefix extends string = ""> = T extends string
  ? Prefix extends ""
    ? never
    : Prefix
  : {
      [K in keyof T & string]: LeavePaths<
        T[K],
        Prefix extends "" ? K : `${Prefix}.${K}`
      >;
    }[keyof T & string];

function getByPath(obj: Messages, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>
): string {
  const raw = getByPath(dictionaries[locale], key) ?? getByPath(en, key) ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    raw
  );
}

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale] ?? en;
}
