import { Circle } from "lucide-react";
import type { ProviderType } from "../types";

interface FooterProps {
  provider: ProviderType;
  activeProvider: string | null;
  mainShortcut: string;
  clipboardShortcut: string;
  pinned: boolean;
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-mono text-[9px] text-neutral-400">
        {keys}
      </kbd>
      <span>{label}</span>
    </span>
  );
}

export function Footer({
  provider,
  activeProvider,
  mainShortcut,
  clipboardShortcut,
  pinned,
}: FooterProps) {
  const providerName =
    activeProvider ?? (provider === "google" ? "Google GTX" : "Bing Web");

  return (
    <footer className="shrink-0 border-t border-white/[0.06] px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-neutral-500">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-neutral-400">
          <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" />
          {providerName}
          {pinned ? (
            <span className="rounded bg-amber-400/10 px-1 text-[9px] text-amber-300">
              PIN
            </span>
          ) : null}
        </span>
        <Hint keys={mainShortcut} label="показать/скрыть" />
        <Hint keys={clipboardShortcut} label="из буфера" />
        <Hint keys="Enter" label="копировать" />
        <Hint keys="Ctrl+C" label="без закрытия" />
        <Hint keys="Ctrl+Enter" label="озвучить" />
        <Hint keys="Tab" label="провайдер" />
        <Hint keys="Esc" label="скрыть" />
      </div>
    </footer>
  );
}
