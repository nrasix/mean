use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::AppState;

/// Сколько времени после последнего движения окна считаем, что идёт перетаскивание.
const DRAG_GRACE: Duration = Duration::from_millis(400);
/// Шаг ожидания, пока перетаскивание завершится.
const DRAG_POLL: Duration = Duration::from_millis(120);

pub const FALLBACK_MAIN_SHORTCUT: &str = "CommandOrControl+Shift+Space";

pub fn default_main_shortcut() -> &'static str {
    "Shift+Alt+T"
}

/// Пользовательские сочетания клавиш, хранящиеся в состоянии приложения.
#[derive(Debug, Clone, Serialize)]
pub struct ShortcutSettings {
    pub main: String,
}

impl Default for ShortcutSettings {
    fn default() -> Self {
        Self {
            main: default_main_shortcut().to_string(),
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

/// Показывает окно, если оно скрыто/не в фокусе, иначе скрывает его.
pub fn toggle_translator_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("Окно main не найдено");
        return;
    };

    let is_visible = window.is_visible().unwrap_or(false);
    let is_focused = window.is_focused().unwrap_or(false);

    if is_visible && is_focused {
        hide_window(app);
    } else {
        show_window(app, true);
    }
}

/// Скрывает окно и сообщает фронтенду, что сессию нужно очистить.
fn hide_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    if let Err(error) = window.hide() {
        eprintln!("Не удалось скрыть окно: {error}");
        return;
    }

    let _ = app.emit("app:window-hidden", ());
}

/// Показывает и фокусирует окно переводчика.
pub fn show_window(app: &AppHandle, notify_frontend: bool) {
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("Окно main не найдено");
        return;
    };

    let _ = window.unminimize();
    // Каждое открытие — строго по центру текущего экрана.
    let _ = window.center();

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

/// Скрывает окно при потере фокуса, если оно не закреплено и не перетаскивается.
fn attach_window_events(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "окно main не найдено".to_string())?;

    let app_handle = app.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::Moved(_) => mark_drag(&app_handle.state::<AppState>()),
        WindowEvent::Focused(false) => {
            let state = app_handle.state::<AppState>();

            // Если окно только что двигали, даём перетаскиванию завершиться:
            // потеря фокуса во время drag не должна оставлять окно навсегда открытым.
            if let Some(delay) = drag_grace_remaining(&state) {
                let app = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(delay).await;

                    loop {
                        let Some(window) = app.get_webview_window("main") else {
                            return;
                        };

                        if window.is_focused().unwrap_or(false) {
                            return;
                        }

                        if !recently_dragged(&app.state::<AppState>()) {
                            hide_window(&app);
                            return;
                        }

                        tokio::time::sleep(DRAG_POLL).await;
                    }
                });
                return;
            }

            hide_window(&app_handle);
        }
        _ => {}
    });

    Ok(())
}

fn mark_drag(state: &AppState) {
    if let Ok(mut guard) = state.last_drag.lock() {
        *guard = Some(Instant::now());
    }
}

/// Остаток защитного окна после последнего движения окна.
fn drag_grace_remaining(state: &AppState) -> Option<Duration> {
    let at = state.last_drag.lock().ok().and_then(|guard| *guard)?;
    let elapsed = at.elapsed();
    (elapsed < DRAG_GRACE).then(|| DRAG_GRACE - elapsed)
}

fn recently_dragged(state: &AppState) -> bool {
    state
        .last_drag
        .lock()
        .map(|guard| guard.map(|at| at.elapsed() < DRAG_GRACE).unwrap_or(false))
        .unwrap_or(false)
}

/// Начинает перетаскивание окна и запоминает время, чтобы не сработало автоскрытие.
#[tauri::command]
pub fn start_window_drag(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
) -> Result<(), String> {
    mark_drag(&state);
    window
        .start_dragging()
        .map_err(|error| format!("не удалось начать перетаскивание: {error}"))
}

/// Возвращает фактические зарегистрированные шорткаты.
#[tauri::command]
pub fn get_shortcuts(state: State<'_, AppState>) -> Result<ShortcutSettings, String> {
    state
        .shortcuts
        .lock()
        .map(|guard| guard.clone())
        .map_err(|_| "состояние шорткатов повреждено".to_string())
}

/// Динамически заменяет глобальный шорткат без перезапуска приложения.
#[tauri::command]
pub fn update_global_shortcut(
    app: AppHandle,
    state: State<'_, AppState>,
    old_shortcut: String,
    new_shortcut: String,
) -> Result<(), String> {
    let old_shortcut = old_shortcut.trim().to_string();
    let new_shortcut = new_shortcut.trim().to_string();

    if new_shortcut.is_empty() {
        return Err("Новый шорткат не может быть пустым".to_string());
    }
    if old_shortcut == new_shortcut {
        return Ok(());
    }

    register_main(&app, &new_shortcut)?;

    if let Err(error) = app.global_shortcut().unregister(old_shortcut.as_str()) {
        let _ = app.global_shortcut().unregister(new_shortcut.as_str());
        return Err(format!("Не удалось снять старый шорткат: {error}"));
    }

    let mut settings = state
        .shortcuts
        .lock()
        .map_err(|_| "состояние шорткатов повреждено".to_string())?;

    settings.main = new_shortcut;

    Ok(())
}
