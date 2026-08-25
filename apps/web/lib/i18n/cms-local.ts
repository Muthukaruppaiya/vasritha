import type { Locale } from "./config";
import { translate, type MessageKey } from "./translate";

/** Use UI translation when CMS still stores the English default copy. */
export function cmsOrT(
  locale: Locale,
  cms: string | null | undefined,
  key: MessageKey
) {
  const translated = translate(locale, key);
  const english = translate("en", key);
  const value = (cms || "").trim();
  if (!value) return translated;
  if (locale === "en") return value;
  if (normalize(value) === normalize(english)) return translated;
  return value;
}

const OFFER_KEYS: MessageKey[] = [
  "offers.firstOrder",
  "offers.freeShipping",
  "offers.jewelryOffer"
];

export function localizeOfferMessage(locale: Locale, message: string) {
  const value = message.trim();
  for (const key of OFFER_KEYS) {
    if (normalize(value) === normalize(translate("en", key))) {
      return translate(locale, key);
    }
  }
  return message;
}

const STATUS_KEYS: MessageKey[] = [
  "home.statusNewSarees",
  "home.statusFestive",
  "home.statusJewelry",
  "home.statusCottons",
  "home.statusBangles",
  "home.statusHandcrafted",
  "home.statusOffers"
];

export function localizeStatusLabel(locale: Locale, label: string) {
  for (const key of STATUS_KEYS) {
    if (normalize(label) === normalize(translate("en", key))) {
      return translate(locale, key);
    }
  }
  return label;
}

const VIDEO_TITLE_KEYS: MessageKey[] = [
  "home.videoFresh",
  "home.videoSaree",
  "home.videoFestive",
  "home.videoCurated"
];
const VIDEO_SUB_KEYS: MessageKey[] = [
  "home.videoFreshSub",
  "home.videoSareeSub",
  "home.videoFestiveSub",
  "home.videoCuratedSub"
];

export function localizeVideoTitle(locale: Locale, title: string) {
  for (const key of VIDEO_TITLE_KEYS) {
    if (normalize(title) === normalize(translate("en", key))) {
      return translate(locale, key);
    }
  }
  return title;
}

export function localizeVideoSubtitle(locale: Locale, subtitle: string) {
  if (!subtitle) return subtitle;
  for (const key of VIDEO_SUB_KEYS) {
    if (normalize(subtitle) === normalize(translate("en", key))) {
      return translate(locale, key);
    }
  }
  return subtitle;
}

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}
