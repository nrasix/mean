import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";

interface UseWindowShortcutEventsOptions {
  onShortcutOpened: () => void;
  onTranslateClipboard: (text: string) => void;
  onOpenSettings: () => void;
  /** Возвращает true, если Escape уже обработан (например, закрытием настроек). */
  onEscape: () => boolean;
}

export function useWindowShortcutEvents(options: UseWindowShortcutEventsOptions) {
  const callbacksRef = useRef(options);

  useEffect(() => {
    callbacksRef.current = options;
  }, [options]);

  useEffect(() => {
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];

    const setup = async () => {
      try {
        const subscriptions = await Promise.all([
          listen("app:shortcut-opened", () => {
            callbacksRef.current.onShortcutOpened();
          }),
          listen<string>("app:translate-clipboard", (event) => {
            callbacksRef.current.onTranslateClipboard(event.payload);
          }),
          listen("app:open-settings", () => {
            callbacksRef.current.onOpenSettings();
          }),
        ]);

        if (disposed) {
          subscriptions.forEach((unlisten) => unlisten());
        } else {
          unlisteners.push(...subscriptions);
        }
      } catch (error) {
        console.warn("События Tauri недоступны", error);
      }
    };

    void setup();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      const handled = callbacksRef.current.onEscape();
      if (!handled) {
        event.preventDefault();
        void getCurrentWindow().hide();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      disposed = true;
      window.removeEventListener("keydown", onKeyDown);
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);
}
