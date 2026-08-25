import { LOCALES, type Locale } from "./config";
import type { CategoryNameI18n } from "./category-names";

export type PredefinedCategory = {
  slug: string;
  description: string;
  names: Record<Locale, string>;
};

export const PREDEFINED_CATEGORIES: PredefinedCategory[] = [
  {
    slug: "sarees",
    description: "Timeless drapes for every occasion.",
    names: {
      en: "Sarees",
      ta: "புடவைகள்",
      ml: "സാരികൾ",
      kn: "ಸೀರೆಗಳು",
      hi: "साड़ियाँ",
      pa: "ਸਾੜੀਆਂ",
      gu: "સાડીઓ"
    }
  },
  {
    slug: "jewelry",
    description: "Finishing touches with enduring radiance.",
    names: {
      en: "Jewelry",
      ta: "நகைகள்",
      ml: "ആഭരണങ്ങൾ",
      kn: "ಆಭರಣಗಳು",
      hi: "ज्वेलरी",
      pa: "ਗਹਿਣੇ",
      gu: "દાગીના"
    }
  },
  {
    slug: "churidhars-salwars",
    description: "Graceful everyday and occasion wear.",
    names: {
      en: "Churidhars & Salwars",
      ta: "சுரிதார்கள் & சல்வார்கள்",
      ml: "ചുരിദാറുകളും സൽവാറുകളും",
      kn: "ಚುರಿದಾರ್ & ಸಲ್ವಾರ್",
      hi: "चूड़ीदार और सलवार",
      pa: "ਚੂੜੀਦਾਰ ਅਤੇ ਸਲਵਾਰ",
      gu: "ચુરીદાર અને સલવાર"
    }
  },
  {
    slug: "handcrafted",
    description: "Artful pieces for thoughtful homes.",
    names: {
      en: "Handcrafted",
      ta: "கைவினைப் பொருட்கள்",
      ml: "കരകൗശലം",
      kn: "ಕೈಕೆಲಸ",
      hi: "हस्तशिल्प",
      pa: "ਹੱਥ-ਕਲਾ",
      gu: "હસ્તકલા"
    }
  },
  {
    slug: "lehengas",
    description: "Festive and bridal lehengas.",
    names: {
      en: "Lehengas",
      ta: "லேகங்காக்கள்",
      ml: "ലെഹങ്കകൾ",
      kn: "ಲೆಹೆಂಗಗಳು",
      hi: "लहंगे",
      pa: "ਲਹਿੰਗੇ",
      gu: "લહેંગા"
    }
  },
  {
    slug: "kurtas",
    description: "Kurtas and kurtis for every day.",
    names: {
      en: "Kurtas",
      ta: "குர்த்தாக்கள்",
      ml: "കുർത്തകൾ",
      kn: "ಕುರ್ತಾಗಳು",
      hi: "कुर्ते",
      pa: "ਕੁੜਤੇ",
      gu: "કુર્તા"
    }
  },
  {
    slug: "blouses",
    description: "Blouses to pair with sarees.",
    names: {
      en: "Blouses",
      ta: "ரவிக்கைகள்",
      ml: "ബ്ലൗസുകൾ",
      kn: "ಬ್ಲೌಸ್",
      hi: "ब्लाउज़",
      pa: "ਬਲਾਊਜ਼",
      gu: "બ્લાઉઝ"
    }
  },
  {
    slug: "dupattas",
    description: "Dupattas and stoles.",
    names: {
      en: "Dupattas",
      ta: "துப்பட்டாக்கள்",
      ml: "ദുപട്ടകൾ",
      kn: "ದುಪ್ಪಟಗಳು",
      hi: "दुपट्टे",
      pa: "ਦੁਪੱਟੇ",
      gu: "દુપટ્ટા"
    }
  },
  {
    slug: "bridal",
    description: "Bridal wear and trousseau.",
    names: {
      en: "Bridal",
      ta: "மணமகள் சேகரிப்பு",
      ml: "വധൂ ശേഖരം",
      kn: "ವಧೂ ಸಂಗ್ರಹ",
      hi: "ब्राइडल",
      pa: "ਬਰਾਈਡਲ",
      gu: "બ્રાઇડલ"
    }
  },
  {
    slug: "festive",
    description: "Festive occasion wear.",
    names: {
      en: "Festive",
      ta: "பண்டிகை",
      ml: "ഉത്സവം",
      kn: "ಹಬ್ಬದ ಸಂಗ್ರಹ",
      hi: "त्योहार",
      pa: "ਤਿਉਹਾਰੀ",
      gu: "તહેવાર"
    }
  },
  {
    slug: "kids-wear",
    description: "Traditional wear for children.",
    names: {
      en: "Kids Wear",
      ta: "குழந்தைகள் உடை",
      ml: "കുട്ടികളുടെ വസ്ത്രം",
      kn: "ಮಕ್ಕಳ ಉಡುಪು",
      hi: "बच्चों के कपड़े",
      pa: "ਬੱਚਿਆਂ ਦੇ ਕੱਪੜੇ",
      gu: "બાળકોના કપડાં"
    }
  },
  {
    slug: "accessories",
    description: "Bags, belts and finishing pieces.",
    names: {
      en: "Accessories",
      ta: "அணிகலன்கள்",
      ml: "ആക്സസറികൾ",
      kn: "ಪರಿಕರಗಳು",
      hi: "एक्सेसरीज़",
      pa: "ਐਕਸੈਸਰੀਜ਼",
      gu: "ઍક્સેસરીઝ"
    }
  },
  {
    slug: "home-decor",
    description: "Pieces for the home.",
    names: {
      en: "Home Decor",
      ta: "வீட்டு அலங்காரம்",
      ml: "ഹോം ഡെക്കോർ",
      kn: "ಮನೆ ಅಲಂಕಾರ",
      hi: "होम डेकोर",
      pa: "ਘਰ ਸਜਾਵਟ",
      gu: "હોમ ડેકોર"
    }
  },
  {
    slug: "pooja",
    description: "Pooja and sacred essentials.",
    names: {
      en: "Pooja",
      ta: "பூஜை",
      ml: "പൂജ",
      kn: "ಪೂಜೆ",
      hi: "पूजा",
      pa: "ਪੂਜਾ",
      gu: "પૂજા"
    }
  },
  {
    slug: "gifts",
    description: "Thoughtful gifting.",
    names: {
      en: "Gifts",
      ta: "பரிசுகள்",
      ml: "സമ്മാനങ്ങൾ",
      kn: "ಉಡುಗೊರೆಗಳು",
      hi: "उपहार",
      pa: "ਤੋਹਫ਼ੇ",
      gu: "ભેટ"
    }
  },
  {
    slug: "testing001",
    description: "Sample category used for language checks.",
    names: {
      en: "Testing001",
      ta: "சோதனை 001",
      ml: "ടെസ്റ്റിംഗ് 001",
      kn: "ಟೆಸ್ಟಿಂಗ್ 001",
      hi: "टेस्टिंग 001",
      pa: "ਟੈਸਟਿੰਗ 001",
      gu: "ટેસ્ટિંગ 001"
    }
  }
];

export const CATEGORY_I18N: Record<string, Partial<Record<Locale, string>>> = Object.fromEntries(
  PREDEFINED_CATEGORIES.map((category) => [category.slug, category.names])
);

export const TYPE_I18N: Record<string, Partial<Record<Locale, string>>> = Object.fromEntries(
  PREDEFINED_CATEGORIES.flatMap((category) => {
    const aliases = new Set(
      [category.names.en, category.slug, ...Object.values(category.names)].filter(Boolean)
    );
    return [...aliases].map((alias) => [alias, category.names]);
  })
);

export function findPredefinedCategory(slugOrName: string | null | undefined) {
  if (!slugOrName) return null;
  const needle = slugOrName.trim().toLowerCase();
  return (
    PREDEFINED_CATEGORIES.find(
      (category) =>
        category.slug === needle ||
        LOCALES.some((locale) => category.names[locale].toLowerCase() === needle)
    ) || null
  );
}

export function predefinedNamesFor(slugOrName: string | null | undefined): CategoryNameI18n {
  return { ...(findPredefinedCategory(slugOrName)?.names || {}) };
}
