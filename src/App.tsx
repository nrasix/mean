import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Footer } from "./components/Footer";
import { ResultList } from "./components/ResultList";
import { SearchBar } from "./components/SearchBar";
import { SettingsModal } from "./components/SettingsModal";
import { Toast } from "./components/Toast";
import { useDebounce } from "./hooks/useDebounce";
import { useTranslation } from "./hooks/useTranslation";
import { useWindowShortcutEvents } from "./hooks/useWindowShortcutEvents";
import { flattenDictionary } from "./lib/dictionary";
import { resolveTargetLang } from "./lib/languages";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./lib/settings";
import type { AppSettings, ProviderType } from "./types";

interface ShortcutSnapshot {
  main: string;
  clipboard: string;
}

async function applyStoredShortcuts(stored: AppSettings): Promise<AppSettings> {
  try {
    const current = await invoke<ShortcutSnapshot>("get_shortcuts");
    const next = { ...stored };

    if (current.main !== next.mainShortcut) {
      try {
        await invoke("update_global_shortcut", {
          oldShortcut: current.main,
          newShortcut: next.mainShortcut,
          target: "main",
        });
      } catch (error) {
        console.warn("Не удалось применить сохранённый основной шорткат", error);
        next.mainShortcut = current.main;
      }
    }

    if (current.clipboard !== next.clipboardShortcut) {
      try {
        await invoke("update_global_shortcut", {
          oldShortcut: current.clipboard,
          newShortcut: next.clipboardShortcut,
          target: "clipboard",
        });
      } catch (error) {
        console.warn("Не удалось применить сохранённый шорткат буфера", error);
        next.clipboardShortcut = current.clipboard;
      }
    }

    return next;
  } catch (error) {
    console.warn("Не удалось синхронизировать шорткаты", error);
    return stored;
  }
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [text, setText] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("auto");
  const [provider, setProvider] = useState<ProviderType>(
    DEFAULT_SETTINGS.provider,
  );
  const [pinned, setPinned] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [toast, setToast] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const settingsRef = useRef(settings);
  const toastTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const {
    result,
    error,
    isLoading,
    targetLangUsed,
    translate,
  } = useTranslation({
    sourceLang,
    targetLang,
    provider,
    nativeLang: settings.nativeLang,
    secondLang: settings.secondLang,
  });

  const debouncedText = useDebounce(text, settings.debounceMs);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await loadSettings();
      if (cancelled) {
        return;
      }

      const effective = await applyStoredShortcuts(stored);
      if (cancelled) {
        return;
      }

      setSettings(effective);
      setProvider(effective.provider);
      setSettingsLoaded(true);

      if (
        effective.mainShortcut !== stored.mainShortcut ||
        effective.clipboardShortcut !== stored.clipboardShortcut
      ) {
        void saveSettings(effective).catch((saveError) => {
          console.warn("Не удалось сохранить скорректированные шорткаты", saveError);
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    void translate(debouncedText);
  }, [
    debouncedText,
    sourceLang,
    targetLang,
    provider,
    settings.nativeLang,
    settings.secondLang,
    settingsLoaded,
    translate,
  ]);

  const flatItems = useMemo(
    () => flattenDictionary(result?.dictionary ?? []),
    [result],
  );

  useEffect(() => {
    setSelectedIndex(-1);
  }, [result]);

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 1800);
  }, []);

  const copyText = useCallback(
    async (value: string, hideAfter: boolean) => {
      try {
        await writeText(value);
      } catch (copyError) {
        console.error(copyError);
        showToast("Не удалось скопировать");
        return;
      }

      if (hideAfter) {
        try {
          await getCurrentWindow().hide();
        } catch (hideError) {
          console.error(hideError);
        }
      } else {
        showToast("Скопировано");
      }
    },
    [showToast],
  );

  const playTts = useCallback(
    async (value: string, lang: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }

      try {
        const bytes = await invoke<number[]>("fetch_tts_audio", {
          text: trimmed,
          lang: lang === "auto" ? "en" : lang,
        });

        if (bytes.length === 0) {
          throw new Error("Пустой аудиоответ");
        }

        if (audioRef.current) {
          audioRef.current.pause();
        }
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
        }

        const url = URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: "audio/mpeg" }),
        );
        const audio = new Audio(url);

        audioUrlRef.current = url;
        audioRef.current = audio;
        audio.onended = () => {
          if (audioUrlRef.current === url) {
            URL.revokeObjectURL(url);
            audioUrlRef.current = null;
          }
        };

        await audio.play();
      } catch (ttsError) {
        console.error(ttsError);
        showToast("Не удалось воспроизвести озвучку");
      }
    },
    [showToast],
  );

  const togglePin = useCallback(async () => {
    const next = !pinned;
    try {
      await invoke("set_window_pin", { pinned: next });
      setPinned(next);
      showToast(next ? "Окно закреплено" : "Автоскрытие включено");
    } catch (pinError) {
      console.error(pinError);
      showToast("Не удалось изменить закрепление");
    }
  }, [pinned, showToast]);

  const toggleProvider = useCallback(() => {
    setProvider((current) => (current === "google" ? "bing" : "google"));
  }, []);

  const swapLanguages = useCallback(() => {
    if (sourceLang === "auto") {
      const concrete = targetLang === "auto" ? settings.nativeLang : targetLang;
      setSourceLang(concrete);
      setTargetLang("auto");
      return;
    }

    const previousSource = sourceLang;
    setSourceLang(targetLang === "auto" ? "auto" : targetLang);
    setTargetLang(previousSource);
  }, [sourceLang, targetLang, settings.nativeLang]);

  const handleSaveSettings = useCallback(
    async (next: AppSettings) => {
      const applied = { ...settings };

      try {
        if (next.mainShortcut !== settings.mainShortcut) {
          await invoke("update_global_shortcut", {
            oldShortcut: settings.mainShortcut,
            newShortcut: next.mainShortcut,
            target: "main",
          });
          applied.mainShortcut = next.mainShortcut;
        }

        if (next.clipboardShortcut !== settings.clipboardShortcut) {
          try {
            await invoke("update_global_shortcut", {
              oldShortcut: settings.clipboardShortcut,
              newShortcut: next.clipboardShortcut,
              target: "clipboard",
            });
            applied.clipboardShortcut = next.clipboardShortcut;
          } catch (clipboardError) {
            if (applied.mainShortcut !== settings.mainShortcut) {
              try {
                await invoke("update_global_shortcut", {
                  oldShortcut: applied.mainShortcut,
                  newShortcut: settings.mainShortcut,
                  target: "main",
                });
                applied.mainShortcut = settings.mainShortcut;
              } catch (rollbackError) {
                console.error("Не удалось откатить основной шорткат", rollbackError);
              }
            }
            throw clipboardError;
          }
        }

        await saveSettings(next);
        setSettings(next);
        setProvider(next.provider);
        setSettingsOpen(false);
        showToast("Настройки сохранены");
      } catch (saveError) {
        setSettings(applied);
        throw saveError;
      }
    },
    [settings, showToast],
  );

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const handleShortcutOpened = useCallback(() => {
    focusInput();

    if (!settingsRef.current.autoTranslateClipboard) {
      return;
    }

    void (async () => {
      try {
        const clipboard = (await readText()).trim();
        if (!clipboard) {
          return;
        }
        setText(clipboard);
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        });
      } catch (clipboardError) {
        console.warn("Буфер обмена недоступен", clipboardError);
      }
    })();
  }, [focusInput]);

  const handleTranslateClipboard = useCallback((value: string) => {
    setText(value);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const handleEscape = useCallback(() => {
    if (isSettingsOpen) {
      setSettingsOpen(false);
      return true;
    }
    return false;
  }, [isSettingsOpen]);

  useWindowShortcutEvents({
    onShortcutOpened: handleShortcutOpened,
    onTranslateClipboard: handleTranslateClipboard,
    onOpenSettings: () => setSettingsOpen(true),
    onEscape: handleEscape,
  });

  const effectiveTarget = useMemo(
    () =>
      resolveTargetLang(
        text,
        targetLang,
        settings.nativeLang,
        settings.secondLang,
      ),
    [text, targetLang, settings.nativeLang, settings.secondLang],
  );

  const ttsLang = targetLangUsed ?? effectiveTarget;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isSettingsOpen) {
        return;
      }

      const activeElement = document.activeElement;
      const inTextarea = activeElement instanceof HTMLTextAreaElement;
      const hasTextSelection =
        inTextarea && activeElement.selectionStart !== activeElement.selectionEnd;

      if (
        event.key === "Tab" &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        toggleProvider();
        return;
      }

      if (event.key === "Enter" && event.ctrlKey) {
        event.preventDefault();
        if (result) {
          void playTts(result.translated_text, ttsLang);
        }
        return;
      }

      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        if (!result) {
          return;
        }
        event.preventDefault();
        const item = selectedIndex >= 0 ? flatItems[selectedIndex] : undefined;
        void copyText(item?.term ?? result.translated_text, true);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        if (!result || hasTextSelection) {
          return;
        }
        event.preventDefault();
        void copyText(result.translated_text, false);
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (flatItems.length === 0) {
          return;
        }
        event.preventDefault();
        setSelectedIndex((current) => {
          const next = event.key === "ArrowDown" ? current + 1 : current - 1;
          if (next < -1) {
            return flatItems.length - 1;
          }
          if (next >= flatItems.length) {
            return 0;
          }
          return next;
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isSettingsOpen,
    result,
    ttsLang,
    flatItems,
    selectedIndex,
    copyText,
    playTts,
    toggleProvider,
  ]);

  return (
    <div className="flex h-screen w-screen justify-center bg-transparent p-2.5">
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl">
        <SearchBar
          inputRef={inputRef}
          text={text}
          onTextChange={setText}
          sourceLang={sourceLang}
          targetLang={targetLang}
          onSourceLangChange={setSourceLang}
          onTargetLangChange={setTargetLang}
          onSwapLanguages={swapLanguages}
          provider={provider}
          onToggleProvider={toggleProvider}
          pinned={pinned}
          onTogglePin={togglePin}
          isLoading={isLoading}
          onOpenSettings={() => setSettingsOpen(true)}
          nativeLang={settings.nativeLang}
          secondLang={settings.secondLang}
        />

        <ResultList
          result={result}
          error={error}
          isLoading={isLoading}
          selectedIndex={selectedIndex}
          flatItems={flatItems}
          onSelectIndex={setSelectedIndex}
          onCopy={copyText}
          onPlayTts={playTts}
          onRetry={() => void translate(text)}
          targetLangUsed={targetLangUsed}
        />

        <Footer
          provider={provider}
          activeProvider={result?.provider ?? null}
          mainShortcut={settings.mainShortcut}
          clipboardShortcut={settings.clipboardShortcut}
          pinned={pinned}
        />

        <Toast message={toast} />

        {isSettingsOpen ? (
          <SettingsModal
            settings={settings}
            onClose={() => setSettingsOpen(false)}
            onSave={handleSaveSettings}
          />
        ) : null}
      </div>
    </div>
  );
}
