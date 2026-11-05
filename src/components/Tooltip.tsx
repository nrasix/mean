import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TooltipState {
  label: string;
  keys?: string;
  rect: DOMRect;
}

const SHOW_DELAY = 250;

function findTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) {
    return null;
  }
  return node.closest<HTMLElement>("[data-tooltip]");
}

/**
 * Единый слой подсказок: элементы помечаются `data-tooltip` и
 * опционально `data-tooltip-keys`, а подсказка рисуется поверх интерфейса.
 */
export function TooltipLayer() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const currentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const hide = () => {
      clearTimer();
      currentRef.current = null;
      setTooltip(null);
    };

    const show = (element: HTMLElement, delay: number) => {
      if (currentRef.current === element) {
        return;
      }

      clearTimer();

      const reveal = () => {
        const label = element.dataset.tooltip;
        if (!label || !element.isConnected) {
          return;
        }

        currentRef.current = element;
        setTooltip({
          label,
          keys: element.dataset.tooltipKeys,
          rect: element.getBoundingClientRect(),
        });
      };

      if (delay > 0) {
        timerRef.current = window.setTimeout(reveal, delay);
      } else {
        reveal();
      }
    };

    const onPointerOver = (event: PointerEvent) => {
      const element = findTarget(event.target);
      if (!element) {
        return;
      }
      if (findTarget(event.relatedTarget) === element) {
        return;
      }
      show(element, SHOW_DELAY);
    };

    const onPointerOut = (event: PointerEvent) => {
      const element = findTarget(event.target);
      if (!element) {
        return;
      }
      if (findTarget(event.relatedTarget) === element) {
        return;
      }
      hide();
    };

    const onFocusIn = (event: FocusEvent) => {
      const element = findTarget(event.target);
      if (element && element.matches(":focus-visible")) {
        show(element, 0);
      }
    };

    const onFocusOut = (event: FocusEvent) => {
      if (findTarget(event.target)) {
        hide();
      }
    };

    const onDismiss = () => hide();

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("mousedown", onDismiss, true);
    document.addEventListener("contextmenu", onDismiss, true);
    document.addEventListener("scroll", onDismiss, true);
    window.addEventListener("blur", onDismiss);
    window.addEventListener("resize", onDismiss);

    return () => {
      clearTimer();
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("mousedown", onDismiss, true);
      document.removeEventListener("contextmenu", onDismiss, true);
      document.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("blur", onDismiss);
      window.removeEventListener("resize", onDismiss);
    };
  }, []);

  useLayoutEffect(() => {
    if (!tooltip) {
      setPosition(null);
      return;
    }

    const element = tooltipRef.current;
    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const gap = 8;
    const margin = 6;
    const below = tooltip.rect.bottom + gap;
    const above = tooltip.rect.top - rect.height - gap;
    const top =
      below + rect.height <= window.innerHeight - margin
        ? below
        : Math.max(margin, above);
    const left = Math.max(
      margin,
      Math.min(
        tooltip.rect.left + tooltip.rect.width / 2 - rect.width / 2,
        window.innerWidth - rect.width - margin,
      ),
    );

    setPosition({ left, top });
  }, [tooltip]);

  if (!tooltip) {
    return null;
  }

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
        opacity: position ? 1 : 0,
      }}
      className="tooltip-enter pointer-events-none fixed z-[90] flex max-w-[300px] items-center gap-2 rounded-md border border-line-strong bg-[#0e0e11] px-2.5 py-1.5 text-[11px] leading-none text-zinc-100 shadow-[0_10px_30px_rgba(0,0,0,0.7)]"
    >
      <span className="truncate">{tooltip.label}</span>
      {tooltip.keys ? (
        <kbd className="shrink-0 rounded border border-line bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-300">
          {tooltip.keys}
        </kbd>
      ) : null}
    </div>,
    document.body,
  );
}
