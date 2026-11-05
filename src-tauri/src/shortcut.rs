use std::sync::atomic::Ordering;

use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::AppState;

pub const FALLBACK_MAIN_SHORTCUT: &str = "CommandOrControl+Shift+Space";
pub const DEFAULT_CLIPBOARD_SHORTCUT: &str = "CommandOrControl+Shift+T";

pub fn default_main_shortcut() -> &'static str {
    if cfg!(target_os = "macos") {
        FALLBACK_MAIN_SHORTCUT
    } else {
        "Alt+Space"
    }
}

/// Пользовательские сочетания клавиш, хранящиеся в состоянии приложения.
#[derive(Debug, Clone)]
pub struct ShortcutSettings {
    pub main: String,
    pub clipboard: String,
}

impl Default for ShortcutSettings {
    fn default() -> Self {
        Self {
            main: default_main_shortcut().to_string(),
            clipboard: DEFAULT_CLIPBOARD_SHORTCUT.to_string(),
        }
    }
}

/// Регистрирует шорткаты по умолчанию и системные обработчики окна.
pub fn init(app: &AppHandle) -> Result<(), String> {
    let settings = current_settings(app)?;

    if let Err(primary_error) = register_main(app, &settings.main) {
        eprintln!(
            "Не удалось зарегистрировать основной шорткат {}: {}",
            settings.main, primary_error
        );

        if !settings.main.eq_ignore_ascii_case(FALLBACK_MAIN_SHORTCUT) {
            register_main(app, FALLBACK_MAIN_SHORTCUT).map_err(|fallback_error| {
                format!(
                    "не удалось зарегистрировать ни {}, ни {}: {}",
                    settings.main, FALLBACK_MAIN_SHORTCUT, fallback_error
                )
            })?;
            set_main_shortcut(app, FALLBACK_MAIN_SHORTCUT)?;
        } else {
            return Err(primary_error);
        }
    }

    if let Err(error) = register_clipboard(app, &settings.clipboard) {
        eprintln!(
            "Не удалось зарегистрировать шорткат буфера обмена {}: {}",
            settings.clipboard, error
        );
    }

    attach_window_events(app)?;
    Ok(())
}

fn current_settings(app: &AppHandle) -> Result<ShortcutSettings, String> {
    app.state::<AppState>()
        .shortcuts
        .lock()
        .map(|guard| guard.clone())
        .map_err(|_| "состояние шорткатов повреждено".to_string())
}

fn set_main_shortcut(app: &AppHandle, value: &str) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut settings = state
        .shortcuts
        .lock()
        .map_err(|_| "состояние шорткатов повреждено".to_string())?;
    settings.main = value.to_string();
    Ok(())
}

fn register_main(app: &AppHandle, shortcut: &str) -> Result<(), String> {
    app.global_shortcut()
        .on_shortcut(shortcut, |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                toggle_translator_window(app);
            }
        })
        .map_err(|error| error.to_string())
}

fn register_clipboard(app: &AppHandle, shortcut: &str) -> Result<(), String> {
    app.global_shortcut()
        .on_shortcut(shortcut, |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                translate_from_clipboard(app);
            }
        })
        .map_err(|error| error.to_string())
}

/// Показывает окно, если оно скрыто/не в фокусе, иначе скрывает его.
pub fn toggle_translator_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("Окно main не найдено");
        return;
    };

    let is_visible = window.is_visible().unwrap_or(false);
    let is_focused = window.is_focused().unwrap_or(false);

    if is_visible && is_focused {
        if let Err(error) = window.hide() {
            eprintln!("Не удалось скрыть окно: {error}");
        }
    } else {
        show_window(app, true);
    }
}

/// Показывает и фокусирует окно переводчика.
pub fn show_window(app: &AppHandle, notify_frontend: bool) {
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("Окно main не найдено");
        return;
    };

    let _ = window.unminimize();

    if let Err(error) = window.show() {
        eprintln!("Не удалось показать окно: {error}");
        return;
    }

    // Windows ограничивает SetForegroundWindow для фоновых процессов.
    // Кратковременное переключение always_on_top помогает забрать фокус.
    #[cfg(target_os = "windows")]
    {
        let _ = window.set_always_on_top(false);
        let _ = window.set_always_on_top(true);
    }

    if let Err(error) = window.set_focus() {
        eprintln!("Не удалось сфокусировать окно: {error}");
    }

    if notify_frontend {
        let _ = app.emit("app:shortcut-opened", ());
    }
}

/// Показывает окно и просит фронтенд открыть настройки.
pub fn show_settings(app: &AppHandle) {
    show_window(app, false);
    let _ = app.emit("app:open-settings", ());
}

/// Читает буфер обмена и сразу отправляет текст во фронтенд на перевод.
pub fn translate_from_clipboard(app: &AppHandle) {
    let text = match app.clipboard().read_text() {
        Ok(text) => text,
        Err(error) => {
            eprintln!("Не удалось прочитать буфер обмена: {error}");
            String::new()
        }
    };

    show_window(app, false);
    let _ = app.emit("app:translate-clipboard", text);
}

/// Скрывает окно при потере фокуса, если оно не закреплено.
fn attach_window_events(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "окно main не найдено".to_string())?;

    let app_handle = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::Focused(false) = event {
            let state = app_handle.state::<AppState>();
            if state.is_pinned.load(Ordering::Relaxed) {
                return;
            }

            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.hide();
            }
        }
    });

    Ok(())
}

/// Динамически заменяет глобальный шорткат без перезапуска приложения.
#[tauri::command]
pub fn update_global_shortcut(
    app: AppHandle,
    state: State<'_, AppState>,
    old_shortcut: String,
    new_shortcut: String,
    target: Option<String>,
) -> Result<(), String> {
    let old_shortcut = old_shortcut.trim().to_string();
    let new_shortcut = new_shortcut.trim().to_string();

    if new_shortcut.is_empty() {
        return Err("Новый шорткат не может быть пустым".to_string());
    }
    if old_shortcut == new_shortcut {
        return Ok(());
    }

    let is_clipboard = target
        .as_deref()
        .map(|value| value.eq_ignore_ascii_case("clipboard"))
        .unwrap_or(false);

    if is_clipboard {
        register_clipboard(&app, &new_shortcut)?;
    } else {
        register_main(&app, &new_shortcut)?;
    }

    if let Err(error) = app.global_shortcut().unregister(old_shortcut.as_str()) {
        let _ = app.global_shortcut().unregister(new_shortcut.as_str());
        return Err(format!("Не удалось снять старый шорткат: {error}"));
    }

    let mut settings = state
        .shortcuts
        .lock()
        .map_err(|_| "состояние шорткатов повреждено".to_string())?;

    if is_clipboard {
        settings.clipboard = new_shortcut;
    } else {
        settings.main = new_shortcut;
    }

    Ok(())
}

/// Закрепляет окно поверх остальных и отключает автоскрытие.
#[tauri::command]
pub fn set_window_pin(pinned: bool, state: State<'_, AppState>) -> Result<(), String> {
    state.is_pinned.store(pinned, Ordering::Relaxed);
    Ok(())
}
