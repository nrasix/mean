# Mean Translator

[![CI](https://github.com/nrasix/mean/actions/workflows/ci.yml/badge.svg)](https://github.com/nrasix/mean/actions/workflows/ci.yml)

A minimalistic background translator launcher for Windows, macOS and Linux, inspired by Spotlight and Command Palette. It lives in the system tray, opens over any window with a global shortcut and translates as you type — no API keys, sign-ups or subscriptions.

<p align="center">
  <strong>Tauri v2 · React 19 · TypeScript · Rust</strong>
</p>

🇷🇺 Русская версия: [README.ru.md](README.ru.md)

## Features

- **Instant access** — the `Shift+Alt+T` global shortcut opens the window above all applications.
- **No "Translate" button** — 150–800 ms debounce, results appear while you type.
- **Google and Bing** — public web endpoints without API keys. Google automatically falls back to Bing when unavailable.
- **Dictionary and phonetics** — translation, transcription and dictionary entries by part of speech (Google).
- **Text-to-speech** — `Ctrl+Enter` starts and stops playback; audio stops when the window closes.
- **One Enter** — copies the translation (or the selected word) and hides the window.
- **Fully keyboard-driven** — dictionary navigation, provider switching, input clearing.
- **Monochrome UI** — dark graphite theme, `Inter` + `Geist Mono`, no visual noise.
- **Cross-platform** — Windows, macOS, Linux (X11; on Wayland use a system shortcut).
- **Lightweight** — Rust backend, no Electron, no network requests from the WebView.

## Installation

Ready-to-use builds: **[latest release](https://github.com/nrasix/mean/releases/latest)**.

### Quick install (Windows)

One PowerShell command — downloads the latest installer, verifies its SHA-256 and installs the app into the user profile (no administrator rights required):

```powershell
irm https://raw.githubusercontent.com/nrasix/mean/master/install.ps1 | iex
```

A specific version can be selected as well:

```powershell
.\install.ps1 -Version v1.0.0
```

The script lives in this repository — you can [review it before running](https://github.com/nrasix/mean/blob/main/install.ps1).

### winget

```powershell
winget install nrasix.MeanTranslator
```

Or by moniker:

```powershell
winget install meantranslator
```

The manifest is stored in [`winget/`](winget); publishing to `microsoft/winget-pkgs` is automated with GitHub Actions.

### Windows manually

- **Installer**: `*-setup.exe` (NSIS) or `.msi`.
- **Portable build**: `*-windows-x64-portable.zip` — extract and run `mean-translator.exe`. No installation required.
- **WebView2 Runtime** is required. It is usually preinstalled on Windows 10/11; otherwise download it from [Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/).

### macOS

- Download the `.dmg` and drag the app into `Applications`.
- The build is not signed or notarized by Apple. On first launch use right-click → **Open**, or run:
  ```bash
  xattr -dr com.apple.quarantine "/Applications/Mean Translator.app"
  ```
- The app runs as an accessory: there is no Dock icon; use the menu bar and the global shortcut.

### Linux

- **AppImage** — portable option: make it executable and run it.
  ```bash
  chmod +x Mean-Translator_*.AppImage
  ./Mean-Translator_*.AppImage
  ```
- Alternatively install the `.deb` / `.rpm` package.
- On **Wayland** the app's global shortcut may be unavailable. Bind a desktop shortcut to:
  ```bash
  mean-translator --toggle
  ```
  A second launch is intercepted by single-instance and toggles the window instead of starting another process.

> **Unsigned build notice.** The current Windows builds are not code-signed, so SmartScreen and UAC may show a warning about an unknown publisher.

## Hotkeys

| Shortcut | Action |
| --- | --- |
| `Shift+Alt+T` | Open / hide the window (configurable) |
| `Enter` | Copy the translation or selected word and close |
| `Ctrl+C` | Copy the translation without closing |
| `Ctrl+Enter` | Play / stop text-to-speech |
| `Ctrl+U` | Clear the input |
| `Tab` | Switch between Google and Bing |
| `↑` / `↓` | Navigate dictionary entries |
| `Esc` | Hide the window |

The global shortcut can be changed in Settings (gear icon), along with the provider, languages, debounce delay and the full hotkey list.

## How it works

```
Global shortcut (Rust)
        │
        ▼
Tauri window (React) ──invoke──▶ Rust command translate_text
                                      │
                                      ├─▶ Google (reqwest, native-tls)
                                      │        └─ fallback: Google extension endpoint
                                      └─▶ Bing (fallback when Google is unavailable)
```

- All network requests run **only in Rust** via `reqwest`. The WebView never accesses the network.
- No API keys are used: the app relies on public Google Translate and Bing Translator web endpoints.
- Google is called through `native-tls`, because Google responds with `429` to the `rustls` TLS fingerprint.
- Responses from both providers are normalized into a shared `TranslationResponse` contract; the UI does not depend on the source.
- Settings are stored locally via `tauri-plugin-store` (`settings.json`).

**Privacy:** the app collects no telemetry and sends data nowhere except the selected translation service. The text is sent directly to Google or Bing.

## Building from source

### Requirements

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (stable)
- Tauri v2 system dependencies: [prerequisites](https://v2.tauri.app/start/prerequisites/)

Linux (Ubuntu/Debian):

```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \
  patchelf libssl-dev pkg-config
```

### Development

```bash
npm install
npm run tauri dev
```

### Release build

```bash
npm run tauri build
```

Artifacts appear in `src-tauri/target/release/bundle/`; the standalone binary is in `src-tauri/target/release/`.

### Checks

```bash
npm run build          # TypeScript + Vite
cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test             # network live tests are marked #[ignore]
```

The same checks run in CI (`.github/workflows/ci.yml`) for every pull request.

## Release

Releases are built by GitHub Actions when a tag is pushed:

```bash
git tag v1.0.0
git push origin v1.0.0
```

`.github/workflows/release.yml` produces Windows installers, macOS builds for Intel and Apple Silicon, Linux packages, and a portable Windows ZIP.

## Stack

| Layer | Technologies |
| --- | --- |
| Core | Tauri v2, Rust, `reqwest`, `tokio`, `serde`, `thiserror`, `regex` |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, `lucide-react` |
| Plugins | global-shortcut, clipboard-manager, store, single-instance |
| Fonts | `@fontsource-variable/inter`, `@fontsource-variable/geist-mono` |

## Known limitations

- Google and Bing are unofficial public endpoints. They may change responses or temporarily rate-limit requests; fallback chains are in place.
- Phonetics and dictionary entries come from Google. The extension fallback and Bing return translations but may omit dictionary entries.
- macOS builds are not notarized, so the first launch requires confirmation.
- On Wayland, global shortcuts depend on the desktop environment — use `--toggle`.

## License

[MIT](LICENSE) © Mean Translator contributors. Free to use, modify and distribute.
