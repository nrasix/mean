# AGENTS.md — Лаунчер-переводчик (Tauri v2 + React)

Настоящий файл — краткое руководство для AI-агентов и разработчиков. Источник истины по объёму работ — `TODO.md`. Задачи выполняются строго последовательно: Этап 1 → Этап 6, с проверкой критерия готовности каждого этапа перед отметкой `[x]`.

## Что это за проект

Кроссплатформенный (Windows / macOS / Linux) фоновый лаунчер-переводчик в стиле Spotlight / Command Palette.
Работает как «stealth»-приложение: стартует скрытым в трее, вызывается глобальным шорткатом поверх всех окон, сразу переводит введённый или буферный текст без API-ключей.

Референс логики: `poychang/CmdPalTranslator` (расширение PowerToys). Логику переиспользуем, но архитектуру строим под Tauri, а не под PowerToys.

## Стек

| Слой | Технологии |
| --- | --- |
| Ядро / системный слой | Tauri v2 (Rust) |
| Фронтенд | React 19, TypeScript, Vite, Tailwind CSS, lucide-react |
| HTTP в Rust | `reqwest` (`json`, `gzip`, `cookies`, `rustls-tls`) |
| Async | `tokio` (`full`) |
| Сериализация | `serde` (`derive`), `serde_json` |
| Ошибки | `thiserror` |
| Парсинг HTML | `regex` |
| Плагины | `global-shortcut`, `clipboard-manager`, `store`, опционально `positioner`, `autostart` |

## Критические архитектурные правила

1. **Все сетевые запросы к переводчикам — только в Rust через `reqwest`.** Из WebView (React) запросы запрещены: CORS, невозможность подменить `User-Agent` / `Referer`, риск блокировки. Фронтенд вызывает только Tauri-команды.
2. **Окно — инструмент, а не приложение.** Стартует `visible: false`, живёт в трее, показывается по шорткату, скрывается по повторному шорткату / `Escape` / потере фокуса (если не закреплено).
3. **Никаких API-ключей.** Используются публичные веб-эндпоинты Google Translate (`translate.googleapis.com`) и Bing Translator (`bing.com/ttranslatev3`).
4. **Один контракт данных для всех провайдеров.** Google и Bing нормализуются в общие модели `TranslationRequest` / `TranslationResponse`; UI не знает о различиях провайдеров.
5. **Устойчивость к rate-limit.** При `429` / капче Google — автоматический fallback на Bing с пометкой `provider: "Bing (Fallback)"`.
6. **Шорткаты обрабатываются только по `ShortcutState::Pressed`**, иначе будет двойное срабатывание на `Released`.
7. **Фронтенд не доверяет порядку ответов.** Debounce + проверка актуальности `requestId`, чтобы устаревшие ответы не перезатирали свежие.

## Планируемая структура проекта

```
.
├── src/                          # React-фронтенд
│   ├── components/
│   │   ├── SearchBar.tsx         # drag-region, textarea с автофокусом, языки, провайдер, Pin
│   │   ├── ResultList.tsx        # перевод, фонетика, словарь по частям речи, навигация ↑/↓
│   │   ├── Footer.tsx            # провайдер + подсказки хоткеев
│   │   ├── SettingsModal.tsx     # настройки (store)
│   │   └── ShortcutRecorder.tsx  # запись нового глобального шортката
│   ├── hooks/
│   │   ├── useWindowShortcutEvents.ts  # listen('app:shortcut-opened'), Escape → hide
│   │   └── useDebounce.ts              # задержка 150–800 мс, requestId
│   ├── App.tsx
│   └── ...
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs                # сборка приложения, плагины, состояние, tray
│   │   ├── commands.rs           # translate_text, fetch_tts_audio, update_global_shortcut, set_window_pin
│   │   ├── shortcut.rs           # глобальные шорткаты, toggle_translator_window
│   │   ├── tray.rs               # иконка и меню трея
│   │   └── translator/
│   │       ├── models.rs         # общие модели данных
│   │       ├── client.rs         # общий reqwest-клиент (UA, cookies, gzip, timeout 10s)
│   │       ├── google.rs         # Google GTX
│   │       ├── bing.rs           # Bing + кэш токена
│   │       └── tts.rs            # Google TTS → MP3 bytes
│   ├── capabilities/default.json # разрешения окна / clipboard / shortcut / store
│   ├── tauri.conf.json
│   └── Cargo.toml
├── .github/workflows/release.yml
├── TODO.md
└── AGENTS.md
```

## Ключевые технические детали

### Rust / переводчики

- **Общий клиент** (`translator/client.rs`): `User-Agent` современного Chrome, `cookie_store(true)`, `gzip(true)`, timeout 10 с. Хранить как управляемое состояние, а не создавать на каждый запрос.
- **Google** — `GET /translate_a/single` с `client=gtx`, `sl`, `tl`, `dt=t`, `dt=bd`, `dt=rm`, `dj=1`, `q`. Ответ: склеить `sentences[].trans`, взять `sentences[].src_translit` в `phonetic`, `dict[]` → `Vec<DictionaryEntry>`.
- **Bing** — `BingTokenCache` под `tokio::sync::RwLock` с `ig`, `iid`, `key`, `token`, `expiry`. Токен достаётся из HTML `https://www.bing.com/translator` регулярками (`IG`, `data-iid`, `params_AbusePreventionHelper`). Перевод — `POST /ttranslatev3` form-urlencoded. При `401` / пустом ответе — сброс кэша, один повтор.
- **Авто-цель** (`target_lang == "auto"`): если во входном тексте кириллица — переводить на `en`, иначе на `ru`.
- **TTS** — `fetch_tts_audio(text, lang)` → `Vec<u8>` MP3 из `translate.googleapis.com/translate_tts`, воспроизведение во фронтенде через `Audio`.
- Все команды возвращают `Result<T, String>`; ошибки — человекочитаемые, без паник в рантайме.

### Окно и системная интеграция

- `tauri.conf.json`: `680×440`, `decorations: false`, `transparent: true`, `alwaysOnTop: true`, `center: true`, `skipTaskbar: true`, `visible: false`.
- `toggle_translator_window`: если скрыто/не в фокусе — `unminimize` + `show` + `set_focus` и событие `app:shortcut-opened`; если видимо и в фокусе — `hide`.
- Событие `app:translate-clipboard` — текст из буфера (читается в Rust) сразу на перевод.
- `WindowEvent::Focused(false)` → `hide`, если `is_pinned == false` (`AtomicBool`, команда `set_window_pin`).
- `update_global_shortcut(old, new)`: `unregister` старого + `register` нового на лету, без перезапуска.
- Трей: левый клик = toggle окна; меню — «Открыть», «Настройки», «Выход».

### Кроссплатформенные нюансы

- **macOS**: `ActivationPolicy::Accessory` (нет иконки в Dock, работа поверх fullscreen).
- **Windows**: кратковременно сбросить/установить `always_on_top` перед `set_focus`, чтобы обойти ограничение `SetForegroundWindow` для фонового процесса.
- **Linux**: проверить X11; для Wayland предусмотреть запуск с флагом `--toggle` через системные шорткаты DE.

## UI / UX-правила

- Управление полностью с клавиатуры: шорткат → ввод → debounce → Enter копирует и скрывает окно.
- `Ctrl+C` копирует без скрытия; `Ctrl+Enter` — TTS; `Tab` — смена провайдера; `Escape` — скрыть.
- `↑` / `↓` — навигация по словарным статьям, `Enter` — копировать выбранное и закрыть.
- Автофокус и `select()` при открытии по шорткату: новый ввод заменяет старый, не требуя ручного стирания.
- Никаких тяжёлых зависимостей и анимаций: приложение должно оставаться лёгким (цель релиза ~8–12 МБ, минимальное потребление памяти).
- Стили — Tailwind; иконки — `lucide-react`; тёмная/светлая тема по системной.

## Команды

```bash
npm install
npm run dev              # только фронтенд (без Tauri)
npm run tauri dev        # полная разработка
npm run tauri build      # релизная сборка
npm run build            # сборка фронтенда (проверка TS)
cd src-tauri && cargo check
cd src-tauri && cargo test
```

## Конвенции разработки

- **Язык интерфейса и комментариев** — русский; имена кода — английский.
- **Порядок этапов обязателен.** Не начинать следующий этап, пока не выполнен критерий готовности текущего.
- **Не ослаблять проверки ради «зелёного» результата**: не удалять тесты, не добавлять `@ts-ignore` / `#[allow(...)]` без причины.
- **Rust-ошибки** — через `thiserror`, наружу в Tauri — `String` с понятным сообщением.
- **Сетевые тесты** (`cargo test`) могут зависеть от доступности интернета: помечать их `#[ignore]` при необходимости и запускать явно.
- **Парсинг ответов переводчиков** — терпимый к изменениям: отсутствующие поля → `None`/пустые коллекции, не паника.
- **Состояние приложения** — через `tauri::State` / `manage`, без глобальных `static mut`.
- **Фронтенд** — функциональные компоненты, хуки, строгая типизация; вызовы бэкенда через `invoke` и типизированные обёртки.
- **Конфигурация** — только через `tauri-plugin-store` (`settings.json`), не хардкодить пользовательские настройки в UI.
- **Git**: атомарные коммиты по шагам этапов; сообщения в повелительном наклонении.

## Definition of Done

- Выполнен критерий готовности соответствующего этапа из `TODO.md`.
- `cargo check` и `npm run build` проходят без ошибок; релевантные тесты — зелёные.
- Приложение работает по «горячему» сценарию: шорткат → ввод/буфер → перевод → Enter → копирование и скрытие.
- Нет сетевых запросов из WebView; нет API-ключей; нет регрессий по скорости открытия окна.
