import { Copy, Languages, RotateCcw, Volume2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { shortLanguageLabel } from "../lib/languages";
import type { FlatDictionaryItem, TranslationResponse } from "../types";

interface ResultListProps {
  result: TranslationResponse | null;
  error: string | null;
  isLoading: boolean;
  selectedIndex: number;
  flatItems: FlatDictionaryItem[];
  onSelectIndex: (index: number) => void;
  onCopy: (text: string, hide: boolean) => void;
  onPlayTts: (text: string, lang: string) => void;
  onRetry: () => void;
  targetLangUsed: string | null;
}

export function ResultList({
  result,
  error,
  isLoading,
  selectedIndex,
  flatItems,
  onSelectIndex,
  onCopy,
  onPlayTts,
  onRetry,
  targetLangUsed,
}: ResultListProps) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (selectedIndex < 0) {
      return;
    }
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const selectedItem =
    selectedIndex >= 0 ? flatItems[selectedIndex] : undefined;

  if (error) {
    return (
      <div className="flex-1 overflow-y-auto px-4 pb-3">
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
          <div className="flex items-start justify-between gap-3">
            <p className="whitespace-pre-wrap">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="flex shrink-0 items-center gap-1 rounded-md bg-red-400/10 px-2 py-1 text-[11px] font-medium text-red-100 transition hover:bg-red-400/20"
            >
              <RotateCcw className="h-3 w-3" />
              Повторить
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 pb-4 text-center">
        {isLoading ? (
          <div className="w-full max-w-[320px] space-y-2">
            <div className="h-6 w-3/4 animate-pulse rounded-md bg-white/[0.06]" />
            <div className="h-4 w-1/2 animate-pulse rounded-md bg-white/[0.04]" />
            <div className="mt-6 h-3 w-2/3 animate-pulse rounded-md bg-white/[0.03]" />
          </div>
        ) : (
          <>
            <Languages className="h-7 w-7 text-neutral-600" />
            <p className="text-sm font-medium text-neutral-400">
              Начните печатать — перевод появится автоматически
            </p>
            <p className="text-xs text-neutral-600">
              Enter — скопировать и закрыть · Ctrl+Enter — озвучить
            </p>
          </>
        )}
      </div>
    );
  }

  const source = result.detected_source_lang ?? "auto";
  const target = targetLangUsed ?? "auto";

  let dictionaryCursor = 0;

  return (
    <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-3">
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.045] p-3">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
          <span>
            {shortLanguageLabel(source)} → {shortLanguageLabel(target)}
          </span>
          <span className="text-neutral-700">•</span>
          <span>{result.provider}</span>
        </div>

        <div className="mt-1 flex items-start gap-2">
          <p
            dir="auto"
            className="min-w-0 flex-1 text-[23px] font-medium leading-snug text-neutral-50"
          >
            {result.translated_text}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onPlayTts(result.translated_text, target)}
              className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
              title="Озвучить (Ctrl+Enter)"
              aria-label="Озвучить перевод"
            >
              <Volume2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onCopy(result.translated_text, false)}
              className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
              title="Копировать (Ctrl+C)"
              aria-label="Копировать перевод"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>

        {result.phonetic ? (
          <p className="mt-0.5 text-sm text-neutral-400">{result.phonetic}</p>
        ) : null}
      </section>

      {result.dictionary.length > 0 ? (
        <section className="space-y-2">
          {result.dictionary.map((entry, entryIndex) => (
            <div
              key={`${entry.part_of_speech}-${entryIndex}`}
              className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-2.5 py-2"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-300/70">
                {entry.part_of_speech}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {entry.terms.map((term) => {
                  const index = dictionaryCursor;
                  dictionaryCursor += 1;
                  const isSelected = index === selectedIndex;

                  return (
                    <button
                      key={`${term}-${index}`}
                      ref={(element) => {
                        itemRefs.current[index] = element;
                      }}
                      type="button"
                      onMouseEnter={() => onSelectIndex(index)}
                      onClick={() => onCopy(term, true)}
                      className={`rounded-md px-2 py-0.5 text-[13px] transition ${
                        isSelected
                          ? "bg-indigo-500/25 text-indigo-100 ring-1 ring-indigo-400/40"
                          : "bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]"
                      }`}
                      title="Enter — скопировать"
                    >
                      {term}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {selectedItem && selectedItem.reverseTranslations.length > 0 ? (
        <div className="px-1 text-[11px] text-neutral-500">
          <span className="text-neutral-600">Обратный перевод: </span>
          {selectedItem.reverseTranslations.join(" · ")}
        </div>
      ) : null}
    </div>
  );
}
