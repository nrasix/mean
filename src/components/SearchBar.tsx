import {
  ArrowLeftRight,
  ChevronDown,
  Globe,
  Loader2,
  Pin,
  PinOff,
  Search,
  Settings,
  X,
} from "lucide-react";
import { useEffect, type RefObject } from "react";
import {
  LANGUAGES,
  shortLanguageLabel,
} from "../lib/languages";
import type { ProviderType } from "../types";

interface SearchBarProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  onTextChange: (value: string) => void;
  sourceLang: string;
  targetLang: string;
  onSourceLangChange: (value: string) => void;
  onTargetLangChange: (value: string) => void;
  onSwapLanguages: () => void;
  provider: ProviderType;
  onToggleProvider: () => void;
  pinned: boolean;
  onTogglePin: () => void;
  isLoading: boolean;
  onOpenSettings: () => void;
  nativeLang: string;
  secondLang: string;
}

const providerLabel: Record<ProviderType, string> = {
  google: "Google",
  bing: "Bing",
};

export function SearchBar({
  inputRef,
  text,
  onTextChange,
  sourceLang,
  targetLang,
  onSourceLangChange,
  onTargetLangChange,
  onSwapLanguages,
  provider,
  onToggleProvider,
  pinned,
  onTogglePin,
  isLoading,
  onOpenSettings,
  nativeLang,
  secondLang,
}: SearchBarProps) {
  useEffect(() => {
    const element = inputRef.current;
    if (!element) {
      return;
    }

    element.style.height = "auto";
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 30), 84)}px`;
  }, [text, inputRef]);

  return (
    <header className="shrink-0">
      <div
        data-tauri-drag-region
        className="flex h-6 cursor-grab items-center justify-center active:cursor-grabbing"
        title="Перетащить окно"
      >
        <div
          data-tauri-drag-region
          className="h-1 w-12 rounded-full bg-white/10"
        />
      </div>

      <div className="flex items-start gap-3 px-4 pb-2">
        <Search className="mt-1.5 h-5 w-5 shrink-0 text-indigo-400" />
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Введите текст для перевода…"
          spellCheck={false}
          className="max-h-[84px] min-h-[30px] w-full resize-none bg-transparent text-[17px] leading-[30px] text-neutral-100 outline-none placeholder:text-neutral-500"
        />
        {text ? (
          <button
            type="button"
            onClick={() => onTextChange("")}
            className="mt-1 rounded-md p-1 text-neutral-500 transition hover:bg-white/5 hover:text-neutral-200"
            title="Очистить (Ctrl+U)"
            aria-label="Очистить ввод"
          >
            <X className="h-4 w-4" />
          </button>
        ) : isLoading ? (
          <Loader2 className="mt-2 h-4 w-4 shrink-0 animate-spin text-indigo-400" />
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 px-4 pb-2.5">
        <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-1">
          <label className="relative">
            <select
              value={sourceLang}
              onChange={(event) => onSourceLangChange(event.target.value)}
              className="appearance-none rounded-md bg-transparent py-1 pl-2 pr-6 text-[11px] font-medium text-neutral-300 outline-none transition hover:bg-white/5"
              aria-label="Исходный язык"
            >
              <option value="auto">Auto</option>
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {shortLanguageLabel(language.code)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-500" />
          </label>

          <button
            type="button"
            onClick={onSwapLanguages}
            className="rounded-md p-1 text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
            title="Поменять языки местами"
            aria-label="Поменять языки местами"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </button>

          <label className="relative">
            <select
              value={targetLang}
              onChange={(event) => onTargetLangChange(event.target.value)}
              className="appearance-none rounded-md bg-transparent py-1 pl-2 pr-6 text-[11px] font-medium text-neutral-300 outline-none transition hover:bg-white/5"
              aria-label="Целевой язык"
            >
              <option value="auto">
                Auto ({shortLanguageLabel(nativeLang)}/
                {shortLanguageLabel(secondLang)})
              </option>
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {shortLanguageLabel(language.code)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-500" />
          </label>
        </div>

        <button
          type="button"
          onClick={onToggleProvider}
          className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-neutral-300 transition hover:bg-white/[0.08] hover:text-neutral-100"
          title="Сменить провайдера (Tab)"
        >
          <Globe className="h-3.5 w-3.5 text-sky-400" />
          {providerLabel[provider]}
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onTogglePin}
            className={`rounded-lg p-1.5 transition ${
              pinned
                ? "bg-amber-400/15 text-amber-300"
                : "text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
            }`}
            title={pinned ? "Отключить закрепление" : "Закрепить окно"}
            aria-label={pinned ? "Отключить закрепление" : "Закрепить окно"}
          >
            {pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
            title="Настройки"
            aria-label="Настройки"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="h-px w-full bg-white/[0.06]" />
      <div className="h-0.5 w-full overflow-hidden bg-transparent">
        {isLoading ? (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-indigo-500/80" />
        ) : null}
      </div>
    </header>
  );
}
