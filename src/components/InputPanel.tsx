import { X } from "lucide-react";
import type { RefObject } from "react";

interface InputPanelProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  onTextChange: (value: string) => void;
}

export function InputPanel({
  inputRef,
  text,
  onTextChange,
}: InputPanelProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-line">
      <div className="flex h-9 shrink-0 items-center justify-between px-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
          Ввод
        </span>
        {text ? (
          <button
            type="button"
            onClick={() => onTextChange("")}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            data-tooltip="Очистить ввод"
            data-tooltip-keys="Ctrl+U"
            aria-label="Очистить ввод"
          >
            <X className="h-3 w-3" strokeWidth={1.8} />
            Очистить
          </button>
        ) : null}
      </div>

      <textarea
        ref={inputRef}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="Введите текст…"
        spellCheck={false}
        className="min-h-0 w-full flex-1 resize-none bg-transparent px-4 pb-4 text-[19px] leading-relaxed tracking-[-0.01em] text-ink caret-white outline-none placeholder:text-zinc-500"
      />
    </section>
  );
}
