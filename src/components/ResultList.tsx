import { Copy, Languages, Loader2, RotateCcw, Square, Volume2 } from "lucide-react";
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
  isTtsPlaying: boolean;
}

const actionClass =
  "rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white";

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
  isTtsPlaying,
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

  const source = result?.detected_source_lang ?? "auto";
  const target = targetLangUsed ?? "auto";

  let dictionaryCursor = 0;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between px-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
          Перевод
        </span>
        {isLoading ? (
          <Loader2
            className="h-3.5 w-3.5 animate-spin text-zinc-400"
            strokeWidth={1.8}
          />
        ) : null}
      </div>

      {error ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-red-200/90">
              {error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 font-mono text-[10px] uppercase tracking-wider text-red-200/70 transition-colors hover:bg-red-500/10 hover:text-red-100"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={1.8} />
              Ещё раз
            </button>
          </div>
        </div>
      ) : !result ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 pb-4 text-center">
          {isLoading ? (
            <div className="w-full max-w-[300px] space-y-3">
              <div className="h-7 w-3/4 animate-pulse rounded bg-white/[0.05]" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-white/[0.035]" />
              <div className="mt-5 h-3 w-2/3 animate-pulse rounded bg-white/[0.025]" />
            </div>
          ) : (
            <>
              <Languages
                className="h-5 w-5 text-zinc-500"
                strokeWidth={1.5}
              />
              <p className="text-[14px] text-zinc-300">
                Перевод появится автоматически
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                Enter — копировать
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
            <span>
              {shortLanguageLabel(source)} → {shortLanguageLabel(target)}
            </span>
            <span className="text-zinc-600">/</span>
            <span>{result.provider}</span>
          </div>

          <div className="mt-2 flex items-start gap-2">
            <p
              dir="auto"
              className="min-w-0 flex-1 text-[26px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink"
            >
              {result.translated_text}
            </p>
            <div className="flex shrink-0 items-center gap-0.5 pt-1">
              <button
                type="button"
                onClick={() => onPlayTts(result.translated_text, target)}
                className={
                  isTtsPlaying
                    ? "rounded-md bg-white p-1.5 text-black transition-colors hover:bg-zinc-200"
                    : actionClass
                }
                title={
                  isTtsPlaying
                    ? "Остановить озвучку (Ctrl+Enter)"
                    : "Озвучить (Ctrl+Enter)"
                }
                aria-label={
                  isTtsPlaying ? "Остановить озвучку" : "Озвучить перевод"
                }
              >
                {isTtsPlaying ? (
                  <Square className="h-3.5 w-3.5 fill-current" strokeWidth={1.8} />
                ) : (
                  <Volume2 className="h-4 w-4" strokeWidth={1.8} />
                )}
              </button>
              <button
                type="button"
                onClick={() => onCopy(result.translated_text, false)}
                className={actionClass}
                title="Копировать (Ctrl+C)"
                aria-label="Копировать перевод"
              >
                <Copy className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {result.phonetic ? (
            <p className="mt-1 text-[13px] text-zinc-400">{result.phonetic}</p>
          ) : null}

          {result.dictionary.length > 0 ? (
            <>
              <div className="my-3 h-px bg-line" />
              <div className="space-y-3.5">
                {result.dictionary.map((entry, entryIndex) => (
                  <div key={`${entry.part_of_speech}-${entryIndex}`}>
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                      {entry.part_of_speech}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
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
                            className={`rounded-md px-2 py-1 text-[14px] transition-colors ${
                              isSelected
                                ? "bg-white font-medium text-black"
                                : "text-zinc-200 hover:bg-white/[0.06] hover:text-white"
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
              </div>
            </>
          ) : null}

          {selectedItem && selectedItem.reverseTranslations.length > 0 ? (
            <div className="mt-3 flex gap-1.5 text-[11px] leading-relaxed text-zinc-500">
              <span className="shrink-0 text-zinc-400">обратный перевод</span>
              <span className="text-zinc-300">
                {selectedItem.reverseTranslations.join(" · ")}
              </span>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
