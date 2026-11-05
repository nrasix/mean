import { Settings, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { LANGUAGES, languageLabel } from "../lib/languages";
import type { AppSettings, ProviderType } from "../types";
import { ShortcutRecorder } from "./ShortcutRecorder";

interface SettingsModalProps {
  settings: AppSettings;
  onClose: () => void;
  onSave: (settings: AppSettings) => Promise<void>;
}

function errorToString(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Не удалось сохранить настройки";
}

export function SettingsModal({
  settings,
  onClose,
  onSave,
}: SettingsModalProps) {
  const [draft, setDraft] = useState<AppSettings>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <Key extends keyof AppSettings>(
    key: Key,
    value: AppSettings[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await onSave(draft);
    } catch (saveError) {
      setError(errorToString(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-full w-full max-w-[540px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
            <Settings className="h-4 w-4 text-indigo-400" />
            Настройки
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
            aria-label="Закрыть настройки"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-3">
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Глобальные шорткаты
            </h3>
            <ShortcutRecorder
              label="Открыть переводчик"
              value={draft.mainShortcut}
              onChange={(value) => update("mainShortcut", value)}
            />
            <ShortcutRecorder
              label="Перевести буфер обмена"
              value={draft.clipboardShortcut}
              onChange={(value) => update("clipboardShortcut", value)}
            />
            <p className="text-[10px] text-neutral-600">
              Нужен хотя бы один модификатор. Новое сочетание применяется после
              сохранения.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Перевод
            </h3>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-neutral-400">Провайдер</span>
              <select
                value={draft.provider}
                onChange={(event) =>
                  update("provider", event.target.value as ProviderType)
                }
                className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] text-neutral-200 outline-none"
              >
                <option value="google">Google Translate</option>
                <option value="bing">Bing Translator</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-neutral-400">Родной язык</span>
              <select
                value={draft.nativeLang}
                onChange={(event) => update("nativeLang", event.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] text-neutral-200 outline-none"
              >
                {LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {languageLabel(language.code)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-neutral-400">Второй язык</span>
              <select
                value={draft.secondLang}
                onChange={(event) => update("secondLang", event.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] text-neutral-200 outline-none"
              >
                {LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {languageLabel(language.code)}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="text-xs text-neutral-400">
                Переводить буфер при открытии
              </span>
              <input
                type="checkbox"
                checked={draft.autoTranslateClipboard}
                onChange={(event) =>
                  update("autoTranslateClipboard", event.target.checked)
                }
                className="h-3.5 w-3.5 accent-indigo-500"
              />
            </label>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Задержка ввода
              </h3>
              <span className="text-[11px] text-neutral-400">
                {draft.debounceMs} мс
              </span>
            </div>
            <input
              type="range"
              min={150}
              max={800}
              step={50}
              value={draft.debounceMs}
              onChange={(event) =>
                update("debounceMs", Number(event.target.value))
              }
              className="w-full accent-indigo-500"
            />
          </section>

          {error ? (
            <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-white/5 hover:text-neutral-200"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}
