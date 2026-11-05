use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

use crate::{shortcut, AppState};

/// Создаёт иконку в системном трее с контекстным меню.
pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let main_shortcut = app
        .state::<AppState>()
        .shortcuts
        .lock()
        .map(|settings| settings.main.clone())
        .unwrap_or_else(|_| shortcut::default_main_shortcut().to_string());

    let open_label = format!("Открыть переводчик ({main_shortcut})");
    let open = MenuItem::with_id(app, "open", open_label, true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Настройки", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&open, &settings, &quit])?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("mean")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => shortcut::toggle_translator_window(app),
            "settings" => shortcut::show_settings(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                shortcut::toggle_translator_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}
