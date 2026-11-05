pub mod commands;
pub mod shortcut;
pub mod translator;
pub mod tray;

use std::sync::Mutex;
use std::time::Instant;

use shortcut::ShortcutSettings;
use translator::bing::BingProvider;
use translator::client::build_client;

/// Общее состояние приложения, доступное Tauri-командам.
pub struct AppState {
    pub http: reqwest::Client,
    pub bing: BingProvider,
    pub shortcuts: Mutex<ShortcutSettings>,
    pub last_drag: Mutex<Option<Instant>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let http = build_client().expect("не удалось создать HTTP-клиент");
    let state = AppState {
        http,
        bing: BingProvider::new(),
        shortcuts: Mutex::new(ShortcutSettings::default()),
        last_drag: Mutex::new(None),
    };

    tauri::Builder::default()
        // Плагин должен быть зарегистрирован первым: он перехватывает повторный запуск.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if args.iter().any(|arg| arg == "--toggle") {
                shortcut::toggle_translator_window(app);
            } else {
                shortcut::show_window(app, true);
            }
        }))
        .manage(state)
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            // macOS: приложение живёт в строке меню и не занимает Dock.
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            if let Err(error) = shortcut::init(app.handle()) {
                eprintln!("Глобальные шорткаты недоступны: {error}");
            }
            tray::create_tray(app.handle())?;

            // Linux/Wayland: системный шорткат DE может запускать приложение с --toggle.
            if std::env::args().any(|arg| arg == "--toggle") {
                shortcut::show_window(app.handle(), true);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::translate_text,
            commands::fetch_tts_audio,
            shortcut::get_shortcuts,
            shortcut::update_global_shortcut,
            shortcut::start_window_drag
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
