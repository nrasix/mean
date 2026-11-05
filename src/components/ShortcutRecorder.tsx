import { Keyboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isMac } from "../lib/settings";

const MODIFIER_KEYS = new Set([
  "Control",
  "Shift",
  "Alt",
  "Meta",
  "OS",
  "AltGraph",
  "CapsLock",
]);

const NAMED_KEYS = new Set([
  "Tab",
  "Enter",
  "Backspace",
  "Delete",
  "Insert",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

function normalizeKey(key: string): string | null {
  if (key === "Escape") {
    return null;
  }
  if (key === " " || key === "Spacebar") {
    return "Space";
  }
  if (/^[a-zA-Z]$/.test(key)) {
    return key.toUpperCase();
  }
  if (/^[0-9]$/.test(key)) {
    return key;
  }
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) {
    return key;
  }
  return NAMED_KEYS.has(key) ? key : null;
}

function buildShortcut(event: KeyboardEvent): string | null {
  const key = normalizeKey(event.key);
  if (!key) {
    return null;
  }

  const parts: string[] = [];

  if (isMac) {
    if (event.metaKey || event.ctrlKey) {
      parts.push("CommandOrControl");
    }
  } else {
    if (event.ctrlKey) {
      parts.push("CommandOrControl");
    }
    if (event.metaKey) {
      parts.push("Super");
    }
  }

  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }

  if (parts.length === 0) {
    return null;
  }

  return [...parts, key].join("+");
}

export function formatShortcut(value: string): string {
  return value
    .replace("CommandOrControl", isMac ? "Cmd" : "Ctrl")
    .split("+")
    .join(" + ");
}

interface ShortcutRecorderProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ShortcutRecorder({
  label,
  value,
  onChange,
}: ShortcutRecorderProps) {
  const [recording, setRecording] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (recording) {
      buttonRef.current?.focus();
    }
  }, [recording]);

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-neutral-400">{label}</span>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={(event) => {
          if (!recording) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();

          if (event.key === "Escape") {
            setRecording(false);
            return;
          }
          if (MODIFIER_KEYS.has(event.key)) {
            return;
          }

          const shortcut = buildShortcut(event.nativeEvent);
          if (!shortcut) {
            return;
          }

          onChange(shortcut);
          setRecording(false);
        }}
        className={`flex min-w-[160px] items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
          recording
            ? "border-indigo-400/60 bg-indigo-500/15 text-indigo-100"
            : "border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.07]"
        }`}
      >
        <Keyboard className="h-3.5 w-3.5 opacity-70" />
        {recording ? "Нажмите сочетание…" : formatShortcut(value)}
      </button>
    </div>
  );
}
