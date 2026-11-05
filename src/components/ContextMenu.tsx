import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { ClipboardPaste, Copy, Scissors, TextSelect } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

interface ContextMenuProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onNotify?: (message: string) => void;
}

interface MenuState {
  x: number;
  y: number;
  mode: "editable" | "selection";
  hasSelection: boolean;
}

const textareaValueSetter = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype,
  "value",
)?.set;

/** Обновляет DOM-значение так, чтобы React получил штатное событие input. */
function setTextareaValue(element: HTMLTextAreaElement, value: string) {
  textareaValueSetter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

function replaceSelection(
  element: HTMLTextAreaElement,
  replacement: string,
): number {
  const start = element.selectionStart;
  const end = element.selectionEnd;
  const next =
    element.value.slice(0, start) + replacement + element.value.slice(end);
  setTextareaValue(element, next);
  return start + replacement.length;
}

function focusAt(
  element: HTMLTextAreaElement,
  caret: number,
  selectEnd?: number,
) {
  requestAnimationFrame(() => {
    element.focus();
    element.setSelectionRange(caret, selectEnd ?? caret);
  });
}

export function ContextMenu({ inputRef, onNotify }: ContextMenuProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();

      const element = inputRef.current;
      const target = event.target;

      if (element && target === element) {
        setMenu({
          x: event.clientX,
          y: event.clientY,
          mode: "editable",
          hasSelection: element.selectionStart !== element.selectionEnd,
        });
        return;
      }

      const selected = window.getSelection()?.toString().trim() ?? "";
      if (selected.length > 0) {
        setMenu({
          x: event.clientX,
          y: event.clientY,
          mode: "selection",
          hasSelection: true,
        });
        return;
      }

      setMenu(null);
    };

    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, [inputRef]);

  useLayoutEffect(() => {
    if (!menu) {
      setPosition(null);
      return;
    }

    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const margin = 8;
    setPosition({
      left: Math.max(margin, Math.min(menu.x, window.innerWidth - rect.width - margin)),
      top: Math.max(margin, Math.min(menu.y, window.innerHeight - rect.height - margin)),
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenu(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setMenu(null);
    };

    const onDismiss = () => setMenu(null);

    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("scroll", onDismiss, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", onDismiss);
    window.addEventListener("resize", onDismiss);

    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", onDismiss);
      window.removeEventListener("resize", onDismiss);
    };
  }, [menu]);

  const copy = useCallback(async () => {
    const element = inputRef.current;
    const value =
      menu?.mode === "editable" && element
        ? element.value.slice(element.selectionStart, element.selectionEnd)
        : window.getSelection()?.toString() ?? "";

    if (!value) {
      return;
    }

    await writeText(value);
    onNotify?.("Скопировано");
  }, [inputRef, menu?.mode, onNotify]);

  const cut = useCallback(async () => {
    const element = inputRef.current;
    if (!element) {
      return;
    }

    const value = element.value.slice(element.selectionStart, element.selectionEnd);
    if (!value) {
      return;
    }

    await writeText(value);
    const caret = replaceSelection(element, "");
    focusAt(element, caret);
    onNotify?.("Вырезано");
  }, [inputRef, onNotify]);

  const paste = useCallback(async () => {
    const element = inputRef.current;
    if (!element) {
      return;
    }

    const value = await readText();
    if (!value) {
      return;
    }

    const caret = replaceSelection(element, value);
    focusAt(element, caret);
  }, [inputRef]);

  const selectAll = useCallback(() => {
    const element = inputRef.current;
    if (!element) {
      return;
    }
    element.focus();
    element.select();
  }, [inputRef]);

  const run = (action: () => void | Promise<void>) => {
    setMenu(null);
    void Promise.resolve(action()).catch((error) => {
      console.error(error);
      onNotify?.("Не удалось выполнить действие");
    });
  };

  if (!menu) {
    return null;
  }

  const editable = menu.mode === "editable";

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Контекстное меню"
      style={{
        left: position?.left ?? menu.x,
        top: position?.top ?? menu.y,
        visibility: position ? "visible" : "hidden",
      }}
      className="context-menu-enter fixed z-[80] min-w-[188px] rounded-lg border border-line-strong bg-[#0e0e11] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.7)]"
      onContextMenu={(event) => event.preventDefault()}
    >
      {editable ? (
        <>
          <MenuItem
            icon={<Scissors className="h-3.5 w-3.5" strokeWidth={1.8} />}
            label="Вырезать"
            shortcut="Ctrl+X"
            disabled={!menu.hasSelection}
            onClick={() => run(cut)}
          />
          <MenuItem
            icon={<Copy className="h-3.5 w-3.5" strokeWidth={1.8} />}
            label="Копировать"
            shortcut="Ctrl+C"
            disabled={!menu.hasSelection}
            onClick={() => run(copy)}
          />
          <MenuItem
            icon={<ClipboardPaste className="h-3.5 w-3.5" strokeWidth={1.8} />}
            label="Вставить"
            shortcut="Ctrl+V"
            onClick={() => run(paste)}
          />
          <div className="my-1 h-px bg-line" />
          <MenuItem
            icon={<TextSelect className="h-3.5 w-3.5" strokeWidth={1.8} />}
            label="Выделить всё"
            shortcut="Ctrl+A"
            onClick={() => run(selectAll)}
          />
        </>
      ) : (
        <MenuItem
          icon={<Copy className="h-3.5 w-3.5" strokeWidth={1.8} />}
          label="Копировать"
          shortcut="Ctrl+C"
          onClick={() => run(copy)}
        />
      )}
    </div>,
    document.body,
  );
}

interface MenuItemProps {
  icon: ReactNode;
  label: string;
  shortcut: string;
  disabled?: boolean;
  onClick: () => void;
}

function MenuItem({
  icon,
  label,
  shortcut,
  disabled = false,
  onClick,
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] text-zinc-200 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-default disabled:text-zinc-600 disabled:hover:bg-transparent"
    >
      <span className="shrink-0 text-zinc-500">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <kbd className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
        {shortcut}
      </kbd>
    </button>
  );
}
