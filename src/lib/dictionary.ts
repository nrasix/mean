import type { DictionaryEntry, FlatDictionaryItem } from "../types";

export function flattenDictionary(dictionary: DictionaryEntry[]): FlatDictionaryItem[] {
  return dictionary.flatMap((entry) =>
    entry.terms.map((term) => {
      const reverse = entry.reverse_translations.find(([word]) => word === term)?.[1] ?? [];
      return {
        term,
        partOfSpeech: entry.part_of_speech,
        reverseTranslations: reverse,
      };
    }),
  );
}
