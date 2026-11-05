# mean

[![CI](https://github.com/nrasix/mean/actions/workflows/ci.yml/badge.svg)](https://github.com/nrasix/mean/actions/workflows/ci.yml)

Минималистичный фоновый лаунчер-переводчик для Windows, macOS и Linux в стиле Spotlight / Command Palette. Живёт в трее, вызывается глобальным шорткатом поверх всех окон и сразу переводит текст — без API-ключей, регистрации и подписок.

<p align="center">
  <strong>Tauri v2 · React 19 · TypeScript · Rust</strong>
</p>

🇬🇧 English version: [README.md](README.md)

## Возможности

- **Мгновенный вызов** — глобальный шорткат `Shift+Alt+T` открывает окно поверх всех приложений.
- **Перевод без клавиши «Перевести»** — debounce 150–800 мс, результат появляется по мере ввода.
- **Google и Bing** — публичные веб-эндпоинты без API-ключей. При недоступности Google автоматически переключается на Bing.
- **Словарь и фонетика** — перевод, транскрипция и словарные статьи по частям речи (Google).
- **Озвучка** — `Ctrl+Enter` запускает и останавливает TTS; звук прекращается при закрытии окна.
- **Один Enter** — копирует перевод (или выбранное слово) в буфер и скрывает окно.
- **Полностью с клавиатуры** — навигация по словарю, смена провайдера, очистка ввода.
- **Монохромный интерфейс** — тёмная графитовая тема, `Inter` + `Geist Mono`, без визуального шума.
- **Кроссплатформенность** — Windows, macOS, Linux (X11; на Wayland — через системный шорткат).
- **Лёгкость** — Rust-бэкенд, нет Electron и сетевых запросов из WebView.

## Установка

Готовые сборки: **[последний релиз](https://github.com/nrasix/mean/releases/latest)**.

### Быстрая установка (Windows)

Одной командой в PowerShell — скачивает последний установщик, проверяет SHA-256 и ставит приложение в профиль пользователя (без прав администратора):

```powershell
irm https://raw.githubusercontent.com/nrasix/mean/master/install.ps1 | iex
```

Можно указать конкретную версию:

```powershell
.\install.ps1 -Version v1.0.0
```

Скрипт лежит в репозитории — его можно [посмотреть перед запуском](https://github.com/nrasix/mean/blob/main/install.ps1).

### winget

```powershell
winget install nrasix.Mean
```

Короткий вариант по moniker:

```powershell
winget install mean
```

Манифест находится в [`winget/`](winget), публикация в `microsoft/winget-pkgs` автоматизирована через GitHub Actions.

### Windows вручную

- **Установщик**: `*-setup.exe` (NSIS) или `.msi`.
- **Портативная версия**: `*-windows-x64-portable.zip` — распакуйте и запустите `mean.exe`. Установка не требуется.
- Требуется **WebView2 Runtime**. В Windows 10/11 он обычно уже установлен; если нет — скачайте с [официального сайта Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/).

### macOS

- Скачайте `.dmg`, перетащите приложение в `Applications`.
- Сборка не подписана и не нотаризована Apple. При первом запуске: правый клик по приложению → **Открыть**, либо выполните:
  ```bash
  xattr -dr com.apple.quarantine "/Applications/mean.app"
  ```
- Приложение работает как accessory: иконки в Dock нет, управление — через строку меню и шорткат.

### Linux

- **AppImage** — портативный вариант: сделайте файл исполняемым и запустите.
  ```bash
  chmod +x mean_*.AppImage
  ./mean_*.AppImage
  ```
- Либо установите `.deb` / `.rpm`.
- На **Wayland** глобальные шорткаты приложения могут быть недоступны. Назначьте системный шорткат на запуск:
  ```bash
  mean --toggle
  ```
  Повторный запуск перехватывается single-instance и переключает окно, а не создаёт второй процесс.

> **Сборки не подписаны.** Установщики Windows не подписаны сертификатом, поэтому SmartScreen и UAC могут показать предупреждение о неизвестном издателе.

## Горячие клавиши

| Сочетание | Действие |
| --- | --- |
| `Shift+Alt+T` | Открыть / скрыть окно (настраивается) |
| `Enter` | Скопировать перевод или выбранное слово и закрыть |
| `Ctrl+C` | Скопировать перевод без закрытия |
| `Ctrl+Enter` | Озвучить / остановить озвучку |
| `Ctrl+U` | Очистить ввод |
| `Tab` | Сменить провайдера Google / Bing |
| `↑` / `↓` | Перемещаться по словарным статьям |
| `Esc` | Скрыть окно |

Глобальный шорткат меняется в настройках (иконка шестерёнки). Там же — провайдер, языки, задержка ввода, автозапуск и список горячих клавиш. Нативное контекстное меню заменено своим: вырезать / копировать / вставить / выделить всё.

## Как это работает

```
Глобальный шорткат (Rust)
        │
        ▼
Окно Tauri (React) ──invoke──▶ Rust-команда translate_text
                                      │
                                      ├─▶ Google (reqwest, native-tls)
                                      │        └─ fallback: extension-эндпоинт Google
                                      └─▶ Bing (fallback при недоступности Google)
```

- Все сетевые запросы выполняются **только в Rust** через `reqwest`. WebView не ходит в сеть.
- API-ключи не используются: применяются публичные веб-эндпоинты Google Translate и Bing Translator.
- Google вызывается через `native-tls`, потому что при TLS-отпечатке `rustls` Google отвечает `429`.
- Ответы обоих провайдеров нормализуются в общий контракт `TranslationResponse`; UI не зависит от источника.
- Настройки хранятся локально через `tauri-plugin-store` (`settings.json`).

**Приватность:** приложение не собирает телеметрию и не отправляет данные никуда, кроме выбранного сервиса перевода. Переводимый текст уходит напрямую в Google или Bing.

## Сборка из исходников

### Требования

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (stable)
- Системные зависимости Tauri v2: [prerequisites](https://v2.tauri.app/start/prerequisites/)

Linux (Ubuntu/Debian):

```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \
  patchelf libssl-dev pkg-config
```

### Запуск

```bash
npm install
npm run tauri dev
```

### Сборка релиза

```bash
npm run tauri build
```

Артефакты появятся в `src-tauri/target/release/bundle/`, готовый бинарник — в `src-tauri/target/release/`.

### Проверки

```bash
npm run build          # TypeScript + Vite
cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test             # сетевые live-тесты помечены #[ignore]
```

Те же проверки выполняет CI (`.github/workflows/ci.yml`) на каждый pull request.

## Релиз

Релизы собираются GitHub Actions при пуше тега:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Workflow `.github/workflows/release.yml` собирает установщики для Windows, macOS (Intel и Apple Silicon) и Linux, а также портативный Windows ZIP.

## Стек

| Слой | Технологии |
| --- | --- |
| Ядро | Tauri v2, Rust, `reqwest`, `tokio`, `serde`, `thiserror`, `regex` |
| Фронтенд | React 19, TypeScript, Vite, Tailwind CSS, `lucide-react` |
| Плагины | global-shortcut, clipboard-manager, store, single-instance |
| Шрифты | `@fontsource-variable/inter`, `@fontsource-variable/geist-mono` |

## Известные ограничения

- Google и Bing — неофициальные публичные эндпоинты. Сервисы могут менять ответы или временно ограничивать запросы; для этого предусмотрены fallback-цепочки.
- Транскрипция и словарь доступны только у Google. Extension-fallback и Bing возвращают перевод, но могут не вернуть словарные статьи.
- На macOS сборка не нотаризована, поэтому первый запуск требует подтверждения.
- На Wayland глобальный шорткат зависит от окружения рабочего стола — используйте `--toggle`.

## Лицензия

[MIT](LICENSE) © mean contributors. Проект можно свободно использовать, изменять и распространять.
