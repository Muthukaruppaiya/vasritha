import type { Locale } from "./config";

export type CatalogText = {
  name: string;
  shortName: string;
  type: string;
  description: string;
  shortDescription?: string;
  color?: string;
};

/** Category slug → localized label */
export const CATEGORY_I18N: Record<string, Partial<Record<Locale, string>>> = {
  sarees: { en: "Sarees", ta: "புடவைகள்", ml: "സാരികൾ", kn: "ಸೀರೆಗಳು" },
  jewelry: { en: "Jewelry", ta: "நகைகள்", ml: "ആഭരണങ്ങൾ", kn: "ಆಭರಣಗಳು" },
  "churidhars-salwars": {
    en: "Churidhars & Salwars",
    ta: "சுரிதார்கள் & சல்வார்கள்",
    ml: "ചുരിദാറുകളും സൽവാറുകളും",
    kn: "ಚುರಿದಾರ್ & ಸಲ್ವಾರ್"
  },
  handcrafted: {
    en: "Handcrafted",
    ta: "கைவினைப் பொருட்கள்",
    ml: "കരകൗശലം",
    kn: "ಕೈಕೆಲಸ"
  }
};

/** Common product-type labels shown on cards */
export const TYPE_I18N: Record<string, Partial<Record<Locale, string>>> = {
  Sarees: CATEGORY_I18N.sarees,
  Jewelry: CATEGORY_I18N.jewelry,
  Handcrafted: CATEGORY_I18N.handcrafted,
  "Churidhars & Salwars": CATEGORY_I18N["churidhars-salwars"]
};

export const COLOR_I18N: Record<string, Partial<Record<Locale, string>>> = {
  "Crimson Red": { en: "Crimson Red", ta: "கிரிம்சன் சிவப்பு", ml: "ക്രിംസൺ ചുവപ്പ്", kn: "ಕ್ರಿಮ್ಸನ್ ಕೆಂಪು" },
  "Blush Pink": { en: "Blush Pink", ta: "பிளஷ் பிங்க்", ml: "ബ്ലഷ് പിങ്ക്", kn: "ಬ್ಲಶ್ ಪಿಂಕ್" },
  "Ivory Cream": { en: "Ivory Cream", ta: "ஐவரி கிரீம்", ml: "ഐവറി ക്രീം", kn: "ಐವರಿ ಕ್ರೀಮ್" },
  "Indigo Blue": { en: "Indigo Blue", ta: "இண்டிகோ நீலம்", ml: "ഇൻഡിഗോ നീല", kn: "ಇಂಡಿಗೋ ನೀಲಿ" },
  "Antique Gold": { en: "Antique Gold", ta: "ஆன்டிக் தங்கம்", ml: "ആന്റിക് സ്വർണം", kn: "ಆಂಟಿಕ್ ಚಿನ್ನ" },
  Gold: { en: "Gold", ta: "தங்கம்", ml: "സ്വർണം", kn: "ಚಿನ್ನ" },
  Multicolour: { en: "Multicolour", ta: "பல நிறம்", ml: "മൾട്ടികളർ", kn: "ಬಹುವರ್ಣ" },
  "Natural Wood": { en: "Natural Wood", ta: "இயற்கை மரம்", ml: "പ്രകൃതി മരം", kn: "ನೈಸರ್ಗಿಕ ಮರ" },
  "Antique Brass": { en: "Antique Brass", ta: "ஆன்டிக் பித்தளை", ml: "ആന്റിക് താമ്രം", kn: "ಆಂಟಿಕ್ ಹಿತ್ತಾಳೆ" }
};

export const SIZE_I18N: Record<string, Partial<Record<Locale, string>>> = {
  "Free Size": { en: "Free Size", ta: "ஃப்ரீ சைஸ்", ml: "ഫ്രീ സൈസ്", kn: "ಫ್ರೀ ಸೈಜ್" },
  "One Size": { en: "One Size", ta: "ஒரே அளவு", ml: "ഒരു സൈസ്", kn: "ಒಂದೇ ಗಾತ್ರ" }
};

/** Product slug → localized catalogue copy */
export const PRODUCT_I18N: Record<string, Partial<Record<Locale, CatalogText>>> = {
  "aarohi-kanchipuram-silk": {
    en: {
      name: "Aarohi Kanchipuram Silk",
      shortName: "Aarohi Kanchipuram",
      type: "Sarees",
      description: "A regal crimson silk saree with a luminous temple-border zari weave.",
      color: "Crimson Red"
    },
    ta: {
      name: "ஆரோகி காஞ்சிபுரம் பட்டு",
      shortName: "ஆரோகி காஞ்சிபுரம்",
      type: "புடவைகள்",
      description: "கோயில் விளிம்பு ஜரிகை நெசவுடன் கூடிய அரச சிவப்பு பட்டுப் புடவை.",
      color: "கிரிம்சன் சிவப்பு"
    },
    ml: {
      name: "ആരോഹി കാഞ്ചീപുരം സിൽക്ക്",
      shortName: "ആരോഹി കാഞ്ചീപുരം",
      type: "സാരികൾ",
      description: "ക്ഷേത്ര ബോർഡർ സാരി നെയ്ത്തോടെയുള്ള ക്രിംസൺ സിൽക്ക് സാരി.",
      color: "ക്രിംസൺ ചുവപ്പ്"
    },
    kn: {
      name: "ಆರೋಹಿ ಕಾಂಚೀಪುರಂ ಸಿಲ್ಕ್",
      shortName: "ಆರೋಹಿ ಕಾಂಚೀಪುರಂ",
      type: "ಸೀರೆಗಳು",
      description: "ದೇವಸ್ಥಾನ ಬಾರ್ಡರ್ ಜರಿ ನೇಯ್ಗೆಯೊಂದಿಗೆ ರಾಜಸಿ ಕೆಂಪು ರೇಷ್ಮೆ ಸೀರೆ.",
      color: "ಕ್ರಿಮ್ಸನ್ ಕೆಂಪು"
    }
  },
  "nandini-banarasi-weave": {
    en: {
      name: "Nandini Banarasi Weave",
      shortName: "Nandini Banarasi",
      type: "Sarees",
      description: "A classic Banarasi silhouette that makes celebration effortless.",
      color: "Blush Pink"
    },
    ta: {
      name: "நந்தினி பனாரசி நெசவு",
      shortName: "நந்தினி பனாரசி",
      type: "புடவைகள்",
      description: "கொண்டாட்டங்களுக்கு எளிதான கிளாசிக் பனாரசி வடிவம்.",
      color: "பிளஷ் பிங்க்"
    },
    ml: {
      name: "നന്ദിനി ബനാറസി നെയ്ത്ത്",
      shortName: "നന്ദിനി ബനാറസി",
      type: "സാരികൾ",
      description: "ആഘോഷങ്ങൾക്ക് അനായാസമായ ക്ലാസിക് ബനാറസി സിലൗറ്റ്.",
      color: "ബ്ലഷ് പിങ്ക്"
    },
    kn: {
      name: "ನಂದಿನಿ ಬನಾರಸಿ ನೇಯ್ಗೆ",
      shortName: "ನಂದಿನಿ ಬನಾರಸಿ",
      type: "ಸೀರೆಗಳು",
      description: "ಆಚರಣೆಗಳನ್ನು ಸುಲಭಗೊಳಿಸುವ ಕ್ಲಾಸಿಕ್ ಬನಾರಸಿ ಸಿಲ್ವೆಟ್.",
      color: "ಬ್ಲಶ್ ಪಿಂಕ್"
    }
  },
  "meera-soft-silk": {
    en: {
      name: "Meera Soft Silk",
      shortName: "Meera Soft",
      type: "Sarees",
      description: "Light, polished, and beautifully draped for all-day elegance.",
      color: "Ivory Cream"
    },
    ta: {
      name: "மீரா சாஃப்ட் சில்க்",
      shortName: "மீரா சாஃப்ட்",
      type: "புடவைகள்",
      description: "நாள் முழுவதும் நேர்த்திக்காக இலகுவான, அழகாக அணியக்கூடிய பட்டு.",
      color: "ஐவரி கிரீம்"
    },
    ml: {
      name: "മീര സോഫ്റ്റ് സിൽക്ക്",
      shortName: "മീര സോഫ്റ്റ്",
      type: "സാരികൾ",
      description: "ദിവസം മുഴുവൻ ഭംഗിക്കായി ലഘുവും മനോഹരവുമായ ഡ്രേപ്പ്.",
      color: "ഐവറി ക്രീം"
    },
    kn: {
      name: "ಮೀರಾ ಸಾಫ್ಟ್ ಸಿಲ್ಕ್",
      shortName: "ಮೀರಾ ಸಾಫ್ಟ್",
      type: "ಸೀರೆಗಳು",
      description: "ದಿನವಿಡೀ ಸೊಬಗಿಗಾಗಿ ಹಗುರವಾದ, ಸುಂದರವಾದ ಡ್ರೇಪ್.",
      color: "ಐವರಿ ಕ್ರೀಮ್"
    }
  },
  "sundari-cotton-weave": {
    en: {
      name: "Sundari Cotton Weave",
      shortName: "Sundari Cotton",
      type: "Sarees",
      description: "Breathable handwoven cotton with a quietly sophisticated border.",
      color: "Indigo Blue"
    },
    ta: {
      name: "சுந்தரி காட்டன் நெசவு",
      shortName: "சுந்தரி காட்டன்",
      type: "புடவைகள்",
      description: "அமைதியான நேர்த்தியான விளிம்புடன் சுவாசிக்கும் கைத்தறி காட்டன்.",
      color: "இண்டிகோ நீலம்"
    },
    ml: {
      name: "സുന്ദരി കോട്ടൺ നെയ്ത്ത്",
      shortName: "സുന്ദരി കോട്ടൺ",
      type: "സാരികൾ",
      description: "ശാന്തമായ ആഡംബര ബോർഡറോടെയുള്ള ശ്വസനക്ഷമമായ കൈത്തറി കോട്ടൺ.",
      color: "ഇൻഡിഗോ നീല"
    },
    kn: {
      name: "ಸುಂದರಿ ಕಾಟನ್ ನೇಯ್ಗೆ",
      shortName: "ಸುಂದರಿ ಕಾಟನ್",
      type: "ಸೀರೆಗಳು",
      description: "ಶಾಂತ ಸೊಬಗಿನ ಬಾರ್ಡರ್‌ನೊಂದಿಗೆ ಉಸಿರಾಡುವ ಕೈಮಗ್ಗ ಹತ್ತಿ.",
      color: "ಇಂಡಿಗೋ ನೀಲಿ"
    }
  },
  "lakshmi-temple-bangles": {
    en: {
      name: "Lakshmi Temple Bangles",
      shortName: "Lakshmi Temple",
      type: "Jewelry",
      description: "Antique-finish bangles with delicately sculpted temple motifs.",
      color: "Antique Gold"
    },
    ta: {
      name: "லட்சுமி கோயில் வளையல்கள்",
      shortName: "லட்சுமி கோயில்",
      type: "நகைகள்",
      description: "நுண்ணிய கோயில் வடிவங்களுடன் ஆன்டிக் பூச்சு வளையல்கள்.",
      color: "ஆன்டிக் தங்கம்"
    },
    ml: {
      name: "ലക്ഷ്മി ക്ഷേത്ര വളകൾ",
      shortName: "ലക്ഷ്മി ക്ഷേത്രം",
      type: "ആഭരണങ്ങൾ",
      description: "സൂക്ഷ്മമായ ക്ഷേത്ര മോട്ടിഫുകളുള്ള ആന്റിക് ഫിനിഷ് വളകൾ.",
      color: "ആന്റിക് സ്വർണം"
    },
    kn: {
      name: "ಲಕ್ಷ್ಮಿ ದೇವಸ್ಥಾನ ಬಳೆಗಳು",
      shortName: "ಲಕ್ಷ್ಮಿ ದೇವಸ್ಥಾನ",
      type: "ಆಭರಣಗಳು",
      description: "ಸೂಕ್ಷ್ಮ ದೇವಸ್ಥಾನ ಮೋಟಿಫ್‌ಗಳೊಂದಿಗೆ ಆಂಟಿಕ್ ಫಿನಿಷ್ ಬಳೆಗಳು.",
      color: "ಆಂಟಿಕ್ ಚಿನ್ನ"
    }
  },
  "chandrika-earrings": {
    en: {
      name: "Chandrika Earrings",
      shortName: "Chandrika Earrings",
      type: "Jewelry",
      description: "A bright, graceful pair to complete an occasion look.",
      color: "Gold"
    },
    ta: {
      name: "சந்திரிகா காதணிகள்",
      shortName: "சந்திரிகா காதணிகள்",
      type: "நகைகள்",
      description: "ஒரு விழா தோற்றத்தை முழுமைப்படுத்தும் ஒளிரும் அழகான ஜோடி.",
      color: "தங்கம்"
    },
    ml: {
      name: "ചന്ദ്രിക കമ്മലുകൾ",
      shortName: "ചന്ദ്രിക കമ്മലുകൾ",
      type: "ആഭരണങ്ങൾ",
      description: "ഒരു അവസര ലുക്ക് പൂർത്തിയാക്കാൻ തിളങ്ങുന്ന മനോഹര ജോഡി.",
      color: "സ്വർണം"
    },
    kn: {
      name: "ಚಂದ್ರಿಕಾ ಕಿವಿಯೋಲೆಗಳು",
      shortName: "ಚಂದ್ರಿಕಾ ಕಿವಿಯೋಲೆಗಳು",
      type: "ಆಭರಣಗಳು",
      description: "ಸಂದರ್ಭದ ನೋಟವನ್ನು ಪೂರ್ಣಗೊಳಿಸುವ ಹೊಳೆಯುವ ಸೊಗಸಾದ ಜೋಡಿ.",
      color: "ಚಿನ್ನ"
    }
  },
  "navratna-temple-necklace": {
    en: {
      name: "Navratna Temple Necklace",
      shortName: "Navratna Temple",
      type: "Jewelry",
      description: "A statement temple necklace finished with rich traditional details.",
      color: "Multicolour"
    },
    ta: {
      name: "நவரத்தின கோயில் நெக்லஸ்",
      shortName: "நவரத்தின கோயில்",
      type: "நகைகள்",
      description: "பாரம்பரிய விவரங்களுடன் கூடிய அழகிய கோயில் நெக்லஸ்.",
      color: "பல நிறம்"
    },
    ml: {
      name: "നവരത്ന ക്ഷേത്ര നെക്ലേസ്",
      shortName: "നവരത്ന ക്ഷേത്രം",
      type: "ആഭരണങ്ങൾ",
      description: "പരമ്പരാഗത വിശദാംശങ്ങളോടെയുള്ള സ്റ്റേറ്റ്മെന്റ് ക്ഷേത്ര നെക്ലേസ്.",
      color: "മൾട്ടികളർ"
    },
    kn: {
      name: "ನವರತ್ನ ದೇವಸ್ಥಾನ ಹಾರ",
      shortName: "ನವರತ್ನ ದೇವಸ್ಥಾನ",
      type: "ಆಭರಣಗಳು",
      description: "ಸಮೃದ್ಧ ಸಾಂಪ್ರದಾಯಿಕ ವಿವರಗಳೊಂದಿಗೆ ಸ್ಟೇಟ್‌ಮೆಂಟ್ ದೇವಸ್ಥಾನ ಹಾರ.",
      color: "ಬಹುವರ್ಣ"
    }
  },
  "hand-carved-lotus-panel": {
    en: {
      name: "Hand-carved Lotus Panel",
      shortName: "Hand-carved Lotus",
      type: "Handcrafted",
      description: "A warm, hand-finished wooden panel celebrating the lotus.",
      color: "Natural Wood"
    },
    ta: {
      name: "கைசெதுக்கப்பட்ட தாமரை பலகை",
      shortName: "கைசெதுக்கப்பட்ட தாமரை",
      type: "கைவினைப் பொருட்கள்",
      description: "தாமரையை கொண்டாடும் கைமுடிவு மரப் பலகை.",
      color: "இயற்கை மரம்"
    },
    ml: {
      name: "കൈകൊണ്ട് കൊത്തിയ താമര പാനൽ",
      shortName: "കൈകൊത്ത് താമര",
      type: "കരകൗശലം",
      description: "താമരയെ ആഘോഷിക്കുന്ന ചൂടുള്ള കൈമുറിവ് മരപ്പലക.",
      color: "പ്രകൃതി മരം"
    },
    kn: {
      name: "ಕೈಕೆತ್ತನೆಯ ಕಮಲ ಫಲಕ",
      shortName: "ಕೈಕೆತ್ತನೆಯ ಕಮಲ",
      type: "ಕೈಕೆಲಸ",
      description: "ಕಮಲವನ್ನು ಆಚರಿಸುವ ಬೆಚ್ಚಗಿನ ಕೈಮುಗಿಸಿದ ಮರದ ಫಲಕ.",
      color: "ನೈಸರ್ಗಿಕ ಮರ"
    }
  },
  "brass-ganesha-idol": {
    en: {
      name: "Brass Ganesha Idol",
      shortName: "Brass Ganesha",
      type: "Handcrafted",
      description: "A finely detailed brass idol for a cherished sacred corner.",
      color: "Antique Brass"
    },
    ta: {
      name: "பித்தளை விநாயகர் சிலை",
      shortName: "பித்தளை விநாயகர்",
      type: "கைவினைப் பொருட்கள்",
      description: "புனித மூலைக்கான நுண்ணிய பித்தளை சிலை.",
      color: "ஆன்டிக் பித்தளை"
    },
    ml: {
      name: "പിത്തള ഗണേശ വിഗ്രഹം",
      shortName: "പിത്തള ഗണേശൻ",
      type: "കരകൗശലം",
      description: "പ്രിയപ്പെട്ട പുണ്യകോണിനുള്ള സൂക്ഷ്മ പിത്തള വിഗ്രഹം.",
      color: "ആന്റിക് താമ്രം"
    },
    kn: {
      name: "ಹಿತ್ತಾಳೆ ಗಣೇಶ ವಿಗ್ರಹ",
      shortName: "ಹಿತ್ತಾಳೆ ಗಣೇಶ",
      type: "ಕೈಕೆಲಸ",
      description: "ಪ್ರೀತಿಯ ಪವಿತ್ರ ಮೂಲೆಗಾಗಿ ಸೂಕ್ಷ್ಮ ಹಿತ್ತಾಳೆ ವಿಗ್ರಹ.",
      color: "ಆಂಟಿಕ್ ಹಿತ್ತಾಳೆ"
    }
  }
};

function pickLocalized<T extends string>(
  map: Partial<Record<Locale, T>> | undefined,
  locale: Locale,
  fallback: T
): T {
  return map?.[locale] || map?.en || fallback;
}

export function localizeCategoryName(slugOrName: string, locale: Locale, fallback?: string) {
  const bySlug = CATEGORY_I18N[slugOrName];
  if (bySlug) return pickLocalized(bySlug, locale, (bySlug.en || fallback || slugOrName) as string);
  const byType = TYPE_I18N[slugOrName];
  if (byType) return pickLocalized(byType, locale, (byType.en || fallback || slugOrName) as string);
  return fallback || slugOrName;
}

export function localizeColor(color: string | null | undefined, locale: Locale) {
  if (!color) return color || "";
  return pickLocalized(COLOR_I18N[color], locale, color);
}

export function localizeSize(size: string, locale: Locale) {
  return pickLocalized(SIZE_I18N[size], locale, size);
}

export function localizeProductFields(
  product: {
    slug: string;
    name: string;
    shortName: string;
    type: string;
    category?: string;
    categoryName?: string;
    description?: string;
    shortDescription?: string;
    color?: string | null;
  },
  locale: Locale
) {
  const entry = PRODUCT_I18N[product.slug]?.[locale] || PRODUCT_I18N[product.slug]?.en;
  const categoryName = localizeCategoryName(
    product.category || product.categoryName || product.type,
    locale,
    product.categoryName || product.type
  );

  return {
    name: entry?.name || product.name,
    shortName: entry?.shortName || product.shortName,
    type: entry?.type || localizeCategoryName(product.type, locale, product.type),
    categoryName,
    description: entry?.description || product.description || "",
    shortDescription: entry?.shortDescription || product.shortDescription || "",
    color: entry?.color || localizeColor(product.color, locale)
  };
}
