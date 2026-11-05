import { Settings, X } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { LANGUAGES, languageLabel } from "../lib/languages";
import type { AppSettings, ProviderType } from "../types";
import { Select } from "./Select";
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
        {title}
      </h3>
      <div className="divide-y divide-line rounded-lg border border-line bg-white/[0.015] px-3.5">
        {children}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[12px] text-zinc-300">{label}</span>
      {children}
    </div>
  );
}

function ShortcutHint({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-[12px] text-zinc-300">{label}</span>
      <kbd className="rounded border border-line bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] tracking-tight text-zinc-100">
        {keys}
      </kbd>
    </div>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
        checked
          ? "border-white/60 bg-white"
          : "border-line bg-white/[0.06] hover:bg-white/[0.09]"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
          checked
            ? "translate-x-[18px] bg-black"
            : "translate-x-0.5 bg-zinc-400"
        }`}
      />
    </button>
  );
}

const providerOptions = [
  { value: "google", label: "Google" },
  { value: "bing", label: "Bing" },
];

const languageOptions = LANGUAGES.map((language) => ({
  value: language.code,
  label: languageLabel(language.code),
}));

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
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-full w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-line-strong bg-[#0b0b0d] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <Settings className="h-4 w-4 text-zinc-500" strokeWidth={1.8} />
            Настройки
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Закрыть настройки"
            data-tooltip="Закрыть настройки"
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-4 py-4">
          <Section title="Глобальные шорткаты">
            <ShortcutRecorder
              label="Открыть переводчик"
              value={draft.mainShortcut}
              onChange={(value) => update("mainShortcut", value)}
            />
          </Section>
          <p className="px-1 text-[11px] leading-relaxed text-zinc-500">
            Новое сочетание применяется после сохранения.
          </p>

          <Section title="Горячие клавиши">
            <ShortcutHint keys="Enter" label="Скопировать и закрыть" />
            <ShortcutHint keys="Ctrl+C" label="Скопировать без закрытия" />
            <ShortcutHint keys="Ctrl+Enter" label="Озвучить / остановить" />
            <ShortcutHint keys="Tab" label="Сменить провайдера" />
            <ShortcutHint keys="↑ / ↓" label="Выбрать слово" />
            <ShortcutHint keys="Ctrl+U" label="Очистить ввод" />
            <ShortcutHint keys="Esc" label="Скрыть окно" />
          </Section>

          <Section title="Перевод">
            <Row label="Провайдер">
              <Select
                ariaLabel="Провайдер перевода"
                value={draft.provider}
                options={providerOptions}
                onChange={(value) =>
                  update("provider", value as ProviderType)
                }
              />
            </Row>

            <Row label="Родной язык">
              <Select
                ariaLabel="Родной язык"
                value={draft.nativeLang}
                options={languageOptions}
                onChange={(value) => update("nativeLang", value)}
              />
            </Row>

            <Row label="Второй язык">
              <Select
                ariaLabel="Второй язык"
                value={draft.secondLang}
                options={languageOptions}
                onChange={(value) => update("secondLang", value)}
              />
            </Row>
          </Section>

          <Section title="Система">
            <Row label="Запускать при старте системы">
              <Toggle
                checked={draft.autostart}
                label="Автозапуск при старте системы"
                onChange={(value) => update("autostart", value)}
              />
            </Row>
          </Section>
          <p className="px-1 text-[11px] leading-relaxed text-zinc-500">
            При автозапуске приложение стартует скрытым в трее.
          </p>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                Задержка ввода
              </h3>
              <span className="font-mono text-[10px] tabular-nums tracking-wider text-zinc-300">
                {draft.debounceMs} мс
              </span>
            </div>
            <div className="rounded-lg border border-line bg-white/[0.015] px-3.5 py-3">
              <input
                type="range"
                min={150}
                max={800}
                step={50}
                value={draft.debounceMs}
                onChange={(event) =>
                  update("debounceMs", Number(event.target.value))
                }
                className="w-full cursor-pointer"
              />
            </div>
          </section>

          {error ? (
            <div className="rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[11px] text-red-200/90">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-100"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-white px-3.5 py-1.5 text-[12px] font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-40"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}
