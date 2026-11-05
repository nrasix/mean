export interface LanguageOption {
  code: string;
  label: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "ru", label: "Русский" },
  { code: "en", label: "Английский" },
  { code: "de", label: "Немецкий" },
  { code: "fr", label: "Французский" },
  { code: "es", label: "Испанский" },
  { code: "it", label: "Итальянский" },
  { code: "pt", label: "Португальский" },
  { code: "zh", label: "Китайский" },
  { code: "ja", label: "Японский" },
  { code: "ko", label: "Корейский" },
  { code: "tr", label: "Турецкий" },
  { code: "uk", label: "Украинский" },
  { code: "pl", label: "Польский" },
];

export function languageLabel(code: string): string {
  if (code === "auto") {
    return "Auto";
  }
  return LANGUAGES.find((language) => language.code === code)?.label ?? code.toUpperCase();
}

export function shortLanguageLabel(code: string): string {
  if (code === "auto") {
    return "AUTO";
  }
  return code.toUpperCase();
}

export function containsCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

export function resolveTargetLang(
  text: string,
  targetLang: string,
  nativeLang: string,
  secondLang: string,
): string {
  if (targetLang !== "auto") {
    return targetLang;
  }
  return containsCyrillic(text) ? secondLang : nativeLang;
}
