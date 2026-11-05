import { invoke } from "@tauri-apps/api/core";
import { ArrowLeftRight, Globe, Loader2, Settings } from "lucide-react";
import { LANGUAGES, shortLanguageLabel } from "../lib/languages";
import type { ProviderType } from "../types";
import { Select } from "./Select";

interface ToolbarProps {
  sourceLang: string;
  targetLang: string;
  onSourceLangChange: (value: string) => void;
  onTargetLangChange: (value: string) => void;
  onSwapLanguages: () => void;
  provider: ProviderType;
  onToggleProvider: () => void;
  onOpenSettings: () => void;
  isLoading: boolean;
  nativeLang: string;
  secondLang: string;
}

const providerLabel: Record<ProviderType, string> = {
  google: "Google",
  bing: "Bing",
};

const languageOptions = LANGUAGES.map((language) => ({
  value: language.code,
  label: shortLanguageLabel(language.code),
}));

export function Toolbar({
  sourceLang,
  targetLang,
  onSourceLangChange,
  onTargetLangChange,
  onSwapLanguages,
  provider,
  onToggleProvider,
  onOpenSettings,
  isLoading,
  nativeLang,
  secondLang,
}: ToolbarProps) {
  return (
    <header className="shrink-0">
      <div
        className="group flex h-4 cursor-grab select-none items-center justify-center active:cursor-grabbing"
        data-tooltip="Перетащить окно"
        onMouseDown={(event) => {
          if (event.button !== 0) {
            return;
          }
          event.preventDefault();
          void invoke("start_window_drag");
        }}
      >
        <div className="pointer-events-none h-[3px] w-10 rounded-full bg-white/15 transition-colors group-hover:bg-white/25" />
      </div>

      <div className="flex items-center gap-2 px-4 pb-2.5">
        <div className="flex items-center overflow-hidden rounded-lg border border-line bg-white/[0.03]">
          <Select
            ariaLabel="Исходный язык"
            variant="ghost"
            value={sourceLang}
            onChange={onSourceLangChange}
            options={[
              { value: "auto", label: "Auto" },
              ...languageOptions,
            ]}
          />

          <button
            type="button"
            onClick={onSwapLanguages}
            className="border-x border-line px-2 py-1.5 text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-white"
            data-tooltip="Поменять языки местами"
            aria-label="Поменять языки местами"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>

          <Select
            ariaLabel="Целевой язык"
            variant="ghost"
            value={targetLang}
            onChange={onTargetLangChange}
            options={[
              {
                value: "auto",
                label: `Auto (${shortLanguageLabel(nativeLang)}/${shortLanguageLabel(secondLang)})`,
              },
              ...languageOptions,
            ]}
          />
        </div>

        <button
          type="button"
          onClick={onToggleProvider}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white"
          data-tooltip="Сменить провайдера"
          data-tooltip-keys="Tab"
        >
          <Globe className="h-3.5 w-3.5" strokeWidth={1.8} />
          {providerLabel[provider]}
        </button>

        <div className="ml-auto flex items-center gap-1">
          {isLoading ? (
            <Loader2
              className="h-3.5 w-3.5 animate-spin text-zinc-400"
              strokeWidth={1.8}
            />
          ) : null}
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            data-tooltip="Настройки"
            aria-label="Настройки"
          >
            <Settings className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="h-px w-full bg-line" />
      <div className="h-px w-full overflow-hidden">
        {isLoading ? (
          <div className="h-px w-1/3 animate-pulse bg-white/40" />
        ) : null}
      </div>
    </header>
  );
}
