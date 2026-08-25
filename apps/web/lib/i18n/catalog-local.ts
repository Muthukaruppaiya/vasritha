import type { Locale } from "./config";
import type { CategoryNameI18n } from "./category-names";
import { CATEGORY_I18N, TYPE_I18N } from "./predefined-categories";

export { CATEGORY_I18N, TYPE_I18N } from "./predefined-categories";

export type CatalogText = {
  name: string;
  shortName: string;
  type: string;
  description: string;
  shortDescription?: string;
  color?: string;
};

export const COLOR_I18N: Record<string, Partial<Record<Locale, string>>> = {
  "Crimson Red": {
    en: "Crimson Red",
    ta: "கிரிம்சன் சிவப்பு",
    ml: "ക്രിംസൺ ചുവപ്പ്",
    kn: "ಕ್ರಿಮ್ಸನ್ ಕೆಂಪು",
    hi: "क्रिमसन लाल",
    pa: "ਕ੍ਰਿਮਸਨ ਲਾਲ",
    gu: "ક્રિમસન લાલ"
  },
  "Blush Pink": {
    en: "Blush Pink",
    ta: "பிளஷ் பிங்க்",
    ml: "ബ്ലഷ് പിങ്ക്",
    kn: "ಬ್ಲಶ್ ಪಿಂಕ್",
    hi: "ब्लश पिंक",
    pa: "ਬਲਸ਼ ਗੁਲਾਬੀ",
    gu: "બ્લશ પિંક"
  },
  "Ivory Cream": {
    en: "Ivory Cream",
    ta: "ஐவரி கிரீம்",
    ml: "ഐവറി ക്രീം",
    kn: "ಐವರಿ ಕ್ರೀಮ್",
    hi: "आइवरी क्रीम",
    pa: "ਆਈਵਰੀ ਕਰੀਮ",
    gu: "આઇવરી ક્રીમ"
  },
  "Indigo Blue": {
    en: "Indigo Blue",
    ta: "இண்டிகோ நீலம்",
    ml: "ഇൻഡിഗോ നീല",
    kn: "ಇಂಡಿಗೋ ನೀಲಿ",
    hi: "इंडिगो नीला",
    pa: "ਇੰਡੀਗੋ ਨੀਲਾ",
    gu: "ઇન્ડિગો વાદળી"
  },
  "Antique Gold": {
    en: "Antique Gold",
    ta: "ஆன்டிக் தங்கம்",
    ml: "ആന്റിക് സ്വർണം",
    kn: "ಆಂಟಿಕ್ ಚಿನ್ನ",
    hi: "एंटीक गोल्ड",
    pa: "ਐਂਟੀਕ ਸੋਨਾ",
    gu: "એન્ટિક ગોલ્ડ"
  },
  Gold: {
    en: "Gold",
    ta: "தங்கம்",
    ml: "സ്വർണം",
    kn: "ಚಿನ್ನ",
    hi: "सोना",
    pa: "ਸੋਨਾ",
    gu: "સોનું"
  },
  Multicolour: {
    en: "Multicolour",
    ta: "பல நிறம்",
    ml: "മൾട്ടികളർ",
    kn: "ಬಹುವರ್ಣ",
    hi: "बहुरंगी",
    pa: "ਬਹੁਰੰਗੀ",
    gu: "બહુરંગી"
  },
  "Natural Wood": {
    en: "Natural Wood",
    ta: "இயற்கை மரம்",
    ml: "പ്രകൃതി മരം",
    kn: "ನೈಸರ್ಗಿಕ ಮರ",
    hi: "प्राकृतिक लकड़ी",
    pa: "ਕੁਦਰਤੀ ਲੱਕੜ",
    gu: "કુદરતી લાકડું"
  },
  "Antique Brass": {
    en: "Antique Brass",
    ta: "ஆன்டிக் பித்தளை",
    ml: "ആന്റിക് താമ്രം",
    kn: "ಆಂಟಿಕ್ ಹಿತ್ತಾಳೆ",
    hi: "एंटीक पीतल",
    pa: "ਐਂਟੀਕ ਪਿੱਤਲ",
    gu: "એન્ટિક પિત્તળ"
  }
};

export const SIZE_I18N: Record<string, Partial<Record<Locale, string>>> = {
  "Free Size": {
    en: "Free Size",
    ta: "ஃப்ரீ சைஸ்",
    ml: "ഫ്രീ സൈസ്",
    kn: "ಫ್ರೀ ಸೈಜ್",
    hi: "फ्री साइज़",
    pa: "ਫ੍ਰੀ ਸਾਈਜ਼",
    gu: "ફ્રી સાઇઝ"
  },
  "One Size": {
    en: "One Size",
    ta: "ஒரே அளவு",
    ml: "ഒരു സൈസ്",
    kn: "ಒಂದೇ ಗಾತ್ರ",
    hi: "एक साइज़",
    pa: "ਇੱਕ ਸਾਈਜ਼",
    gu: "એક સાઇઝ"
  }
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
    },
    hi: {
      name: "आरोही कांचीपुरम सिल्क",
      shortName: "आरोही कांचीपुरम",
      type: "साड़ियाँ",
      description: "मंदिर बॉर्डर जरी बुनाई वाली शाही क्रिमसन रेशमी साड़ी।",
      color: "क्रिमसन लाल"
    },
    pa: {
      name: "ਆਰੋਹੀ ਕਾਂਚੀਪੁਰਮ ਸਿਲਕ",
      shortName: "ਆਰੋਹੀ ਕਾਂਚੀਪੁਰਮ",
      type: "ਸਾੜੀਆਂ",
      description: "ਮੰਦਰ ਬਾਰਡਰ ਜਰੀ ਬੁਣਾਈ ਵਾਲੀ ਸ਼ਾਹੀ ਕ੍ਰਿਮਸਨ ਰੇਸ਼ਮੀ ਸਾੜੀ।",
      color: "ਕ੍ਰਿਮਸਨ ਲਾਲ"
    },
    gu: {
      name: "આરોહી કાંચીપુરમ સિલ્ક",
      shortName: "આરોહી કાંચીપુરમ",
      type: "સાડીઓ",
      description: "મંદિર બોર્ડર ઝરી વણાટવાળી શાહી ક્રિમસન રેશમી સાડી.",
      color: "ક્રિમસન લાલ"
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
    },
    hi: {
      name: "नंदिनी बनारसी वीव",
      shortName: "नंदिनी बनारसी",
      type: "साड़ियाँ",
      description: "उत्सवों के लिए सहज क्लासिक बनारसी सिल्हूट।",
      color: "ब्लश पिंक"
    },
    pa: {
      name: "ਨੰਦਿਨੀ ਬਨਾਰਸੀ ਵੀਵ",
      shortName: "ਨੰਦਿਨੀ ਬਨਾਰਸੀ",
      type: "ਸਾੜੀਆਂ",
      description: "ਜਸ਼ਨਾਂ ਲਈ ਆਸਾਨ ਕਲਾਸਿਕ ਬਨਾਰਸੀ ਸਿਲੂਏਟ।",
      color: "ਬਲਸ਼ ਗੁਲਾਬੀ"
    },
    gu: {
      name: "નંદિની બનારસી વીવ",
      shortName: "નંદિની બનારસી",
      type: "સાડીઓ",
      description: "ઉજવણી માટે સહજ ક્લાસિક બનારસી સિલુએટ.",
      color: "બ્લશ પિંક"
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
    },
    hi: {
      name: "मीरा सॉफ्ट सिल्क",
      shortName: "मीरा सॉफ्ट",
      type: "साड़ियाँ",
      description: "पूरे दिन की खूबसूरती के लिए हल्की, सुंदर ड्रेप।",
      color: "आइवरी क्रीम"
    },
    pa: {
      name: "ਮੀਰਾ ਸਾਫਟ ਸਿਲਕ",
      shortName: "ਮੀਰਾ ਸਾਫਟ",
      type: "ਸਾੜੀਆਂ",
      description: "ਪੂਰੇ ਦਿਨ ਦੀ ਸੁੰਦਰਤਾ ਲਈ ਹਲਕੀ, ਸੋਹਣੀ ਡ੍ਰੇਪ।",
      color: "ਆਈਵਰੀ ਕਰੀਮ"
    },
    gu: {
      name: "મીરા સોફ્ટ સિલ્ક",
      shortName: "મીરા સોફ્ટ",
      type: "સાડીઓ",
      description: "આખા દિવસની ભવ્યતા માટે હળવી, સુંદર ડ્રેપ.",
      color: "આઇવરી ક્રીમ"
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
    },
    hi: {
      name: "सुंदरी कॉटन वीव",
      shortName: "सुंदरी कॉटन",
      type: "साड़ियाँ",
      description: "शांत सुंदर बॉर्डर वाली साँस लेने योग्य हथकरघा कॉटन।",
      color: "इंडिगो नीला"
    },
    pa: {
      name: "ਸੁੰਦਰੀ ਕਾਟਨ ਵੀਵ",
      shortName: "ਸੁੰਦਰੀ ਕਾਟਨ",
      type: "ਸਾੜੀਆਂ",
      description: "ਸ਼ਾਂਤ ਸੁੰਦਰ ਬਾਰਡਰ ਵਾਲੀ ਸਾਹ ਲੈਣ ਵਾਲੀ ਹੱਥਕੱਘ ਕਾਟਨ।",
      color: "ਇੰਡੀਗੋ ਨੀਲਾ"
    },
    gu: {
      name: "સુંદરી કોટન વીવ",
      shortName: "સુંદરી કોટન",
      type: "સાડીઓ",
      description: "શાંત સુંદર બોર્ડરવાળી શ્વાસ લેતી હાથઘૂંટ કોટન.",
      color: "ઇન્ડિગો વાદળી"
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
    },
    hi: {
      name: "लक्ष्मी टेम्पल चूड़ियाँ",
      shortName: "लक्ष्मी टेम्पल",
      type: "ज्वेलरी",
      description: "नाज़ुक मंदिर रूपांकनों वाली एंटीक फिनिश चूड़ियाँ।",
      color: "एंटीक गोल्ड"
    },
    pa: {
      name: "ਲਕਸ਼ਮੀ ਮੰਦਰ ਚੂੜੀਆਂ",
      shortName: "ਲਕਸ਼ਮੀ ਮੰਦਰ",
      type: "ਗਹਿਣੇ",
      description: "ਨਾਜ਼ੁਕ ਮੰਦਰ ਰੂਪਾਂ ਵਾਲੀਆਂ ਐਂਟੀਕ ਫਿਨਿਸ਼ ਚੂੜੀਆਂ।",
      color: "ਐਂਟੀਕ ਸੋਨਾ"
    },
    gu: {
      name: "લક્ષ્મી મંદિર ચૂડીઓ",
      shortName: "લક્ષ્મી મંદિર",
      type: "દાગીના",
      description: "નાજુક મંદિર મોટિફવાળી એન્ટિક ફિનિશ ચૂડીઓ.",
      color: "એન્ટિક ગોલ્ડ"
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
    },
    hi: {
      name: "चंद्रिका झुमके",
      shortName: "चंद्रिका झुमके",
      type: "ज्वेलरी",
      description: "अवसर लुक पूरा करने वाली चमकदार सुंदर जोड़ी।",
      color: "सोना"
    },
    pa: {
      name: "ਚੰਦਰਿਕਾ ਵਾਲੀਆਂ",
      shortName: "ਚੰਦਰਿਕਾ ਵਾਲੀਆਂ",
      type: "ਗਹਿਣੇ",
      description: "ਮੌਕੇ ਵਾਲਾ ਲੁੱਕ ਪੂਰਾ ਕਰਨ ਵਾਲੀ ਚਮਕਦਾਰ ਸੋਹਣੀ ਜੋੜੀ।",
      color: "ਸੋਨਾ"
    },
    gu: {
      name: "ચંદ્રિકા કુંડળ",
      shortName: "ચંદ્રિકા કુંડળ",
      type: "દાગીના",
      description: "પ્રસંગનો લુક પૂર્ણ કરતી ચમકતી સુંદર જોડી.",
      color: "સોનું"
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
    },
    hi: {
      name: "नवरत्न टेम्पल हार",
      shortName: "नवरत्न टेम्पल",
      type: "ज्वेलरी",
      description: "पारंपरिक विवरणों वाला स्टेटमेंट मंदिर हार।",
      color: "बहुरंगी"
    },
    pa: {
      name: "ਨਵਰਤਨ ਮੰਦਰ ਹਾਰ",
      shortName: "ਨਵਰਤਨ ਮੰਦਰ",
      type: "ਗਹਿਣੇ",
      description: "ਰਵਾਇਤੀ ਵੇਰਵਿਆਂ ਵਾਲਾ ਸਟੇਟਮੈਂਟ ਮੰਦਰ ਹਾਰ।",
      color: "ਬਹੁਰੰਗੀ"
    },
    gu: {
      name: "નવરત્ન મંદિર હાર",
      shortName: "નવરત્ન મંદિર",
      type: "દાગીના",
      description: "પરંપરાગત વિગતો સાથે સ્ટેટમેન્ટ મંદિર હાર.",
      color: "બહુરંગી"
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
    },
    hi: {
      name: "हस्त-नक्काशी कमल पैनल",
      shortName: "हस्त-नक्काशी कमल",
      type: "हस्तशिल्प",
      description: "कमल का उत्सव मनाने वाला गर्म हाथ-तैयार लकड़ी पैनल।",
      color: "प्राकृतिक लकड़ी"
    },
    pa: {
      name: "ਹੱਥ-ਨੱਕਾਸ਼ੀ ਕਮਲ ਪੈਨਲ",
      shortName: "ਹੱਥ-ਨੱਕਾਸ਼ੀ ਕਮਲ",
      type: "ਹੱਥ-ਕਲਾ",
      description: "ਕਮਲ ਦਾ ਜਸ਼ਨ ਮਨਾਉਣ ਵਾਲਾ ਗਰਮ ਹੱਥ-ਤਿਆਰ ਲੱਕੜ ਪੈਨਲ।",
      color: "ਕੁਦਰਤੀ ਲੱਕੜ"
    },
    gu: {
      name: "હાથ-નક્કાશી કમળ પેનલ",
      shortName: "હાથ-નક્કાશી કમળ",
      type: "હસ્તકલા",
      description: "કમળની ઉજવણી કરતું ગરમ હાથ-તૈયાર લાકડાનું પેનલ.",
      color: "કુદરતી લાકડું"
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
    },
    hi: {
      name: "पीतल गणेश मूर्ति",
      shortName: "पीतल गणेश",
      type: "हस्तशिल्प",
      description: "प्रिय पवित्र कोने के लिए बारीक पीतल की मूर्ति।",
      color: "एंटीक पीतल"
    },
    pa: {
      name: "ਪਿੱਤਲ ਗਣੇਸ਼ ਮੂਰਤੀ",
      shortName: "ਪਿੱਤਲ ਗਣੇਸ਼",
      type: "ਹੱਥ-ਕਲਾ",
      description: "ਪਿਆਰੇ ਪਵਿੱਤਰ ਕੋਨੇ ਲਈ ਬਾਰੀਕ ਪਿੱਤਲ ਦੀ ਮੂਰਤੀ।",
      color: "ਐਂਟੀਕ ਪਿੱਤਲ"
    },
    gu: {
      name: "પિત્તળ ગણેશ મૂર્તિ",
      shortName: "પિત્તળ ગણેશ",
      type: "હસ્તકલા",
      description: "પ્રિય પવિત્ર ખૂણા માટે સૂક્ષ્મ પિત્તળની મૂર્તિ.",
      color: "એન્ટિક પિત્તળ"
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

export function localizeCategoryName(
  slugOrName: string,
  locale: Locale,
  fallback?: string,
  nameI18n?: CategoryNameI18n | null
) {
  const fromDb = nameI18n?.[locale]?.trim();
  if (fromDb) return fromDb;
  const bySlug = CATEGORY_I18N[slugOrName] || (fallback ? CATEGORY_I18N[fallback] : undefined);
  if (bySlug) return pickLocalized(bySlug, locale, (bySlug.en || fallback || slugOrName) as string);
  const byType = TYPE_I18N[slugOrName] || (fallback ? TYPE_I18N[fallback] : undefined);
  if (byType) return pickLocalized(byType, locale, (byType.en || fallback || slugOrName) as string);
  return nameI18n?.en?.trim() || fallback || slugOrName;
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
