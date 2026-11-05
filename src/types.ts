export type ProviderType = "google" | "bing";

export type DictionaryReverse = [string, string[]];

export interface DictionaryEntry {
  part_of_speech: string;
  terms: string[];
  reverse_translations: DictionaryReverse[];
}

export interface TranslationResponse {
  translated_text: string;
  detected_source_lang: string | null;
  phonetic: string | null;
  dictionary: DictionaryEntry[];
  provider: string;
}

export interface AppSettings {
  mainShortcut: string;
  clipboardShortcut: string;
  autoTranslateClipboard: boolean;
  provider: ProviderType;
  nativeLang: string;
  secondLang: string;
  debounceMs: number;
}

export interface FlatDictionaryItem {
  term: string;
  partOfSpeech: string;
  reverseTranslations: string[];
}
