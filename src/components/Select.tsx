import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  variant?: "default" | "ghost";
  className?: string;
}

const MENU_MAX_HEIGHT = 280;
const MENU_MIN_WIDTH = 160;

export function Select({
  value,
  options,
  onChange,
  ariaLabel,
  variant = "default",
  className = "",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const menuHeight = Math.min(options.length * 38 + 8, MENU_MAX_HEIGHT);
    const width = Math.max(rect.width, MENU_MIN_WIDTH);
    const openUp =
      window.innerHeight - rect.bottom < menuHeight + 8 &&
      rect.top > menuHeight + 8;

    setPosition({
      top: openUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - width - 8),
      width,
    });
  }, [options.length]);

  const openMenu = useCallback(() => {
    updatePosition();
    setActiveIndex(selectedIndex);
    setOpen(true);
  }, [selectedIndex, updatePosition]);

  const choose = useCallback(
    (index: number) => {
      const option = options[index];
      if (option) {
        onChange(option.value);
      }
      setOpen(false);
      buttonRef.current?.focus();
    },
    [onChange, options],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const onResize = () => setOpen(false);

    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="option"]',
    );
    items?.[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "ArrowDown" ||
        event.key === "ArrowUp"
      ) {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % options.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) => (index - 1 + options.length) % options.length,
      );
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    }
  };

  const buttonClass =
    variant === "ghost"
      ? "rounded-none border-0 bg-transparent font-mono text-[11px] uppercase tracking-wider text-zinc-300 hover:bg-white/[0.07] hover:text-white"
      : "rounded-lg border border-line bg-white/[0.03] text-[12px] text-zinc-200 hover:border-line-strong hover:bg-white/[0.05]";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`inline-flex items-center justify-between gap-2 px-2.5 py-1.5 transition-colors ${buttonClass} ${className}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-zinc-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={2}
        />
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                maxHeight: MENU_MAX_HEIGHT,
              }}
              className="fixed z-[60] overflow-y-auto rounded-lg border border-line-strong bg-[#0e0e11] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.65)]"
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(index)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-[12px] transition-colors ${
                      isActive || isSelected
                        ? "bg-white/[0.08] text-white"
                        : "text-zinc-200 hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected ? (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-white"
                        strokeWidth={2}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
