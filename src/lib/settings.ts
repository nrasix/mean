import { load } from "@tauri-apps/plugin-store";
import type { AppSettings } from "../types";

export const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent);

export const DEFAULT_SETTINGS: AppSettings = {
  mainShortcut: "Shift+Alt+T",
  clipboardShortcut: "CommandOrControl+Shift+T",
  autoTranslateClipboard: false,
  provider: "google",
  nativeLang: "ru",
  secondLang: "en",
  debounceMs: 300,
};

const STORE_PATH = "settings.json";
const STORE_KEY = "settings";

let storePromise: ReturnType<typeof load> | null = null;

function getStore() {
  if (!storePromise) {
    storePromise = load(STORE_PATH, {
      autoSave: true,
      defaults: { [STORE_KEY]: DEFAULT_SETTINGS },
    });
  }
  return storePromise;
}

function sanitize(settings: AppSettings): AppSettings {
  const debounce = Number(settings.debounceMs);
  return {
    ...settings,
    provider: settings.provider === "bing" ? "bing" : "google",
    nativeLang: settings.nativeLang || DEFAULT_SETTINGS.nativeLang,
    secondLang: settings.secondLang || DEFAULT_SETTINGS.secondLang,
    mainShortcut: settings.mainShortcut?.trim() || DEFAULT_SETTINGS.mainShortcut,
    clipboardShortcut:
      settings.clipboardShortcut?.trim() || DEFAULT_SETTINGS.clipboardShortcut,
    debounceMs: Number.isFinite(debounce)
      ? Math.min(800, Math.max(150, Math.round(debounce)))
      : DEFAULT_SETTINGS.debounceMs,
  };
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const store = await getStore();
    const saved = await store.get<Partial<AppSettings>>(STORE_KEY);
    return sanitize({ ...DEFAULT_SETTINGS, ...(saved ?? {}) });
  } catch (error) {
    console.warn("Не удалось загрузить настройки", error);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const store = await getStore();
  await store.set(STORE_KEY, settings);
  await store.save();
}
