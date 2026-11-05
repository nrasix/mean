pub mod commands;
pub mod shortcut;
pub mod translator;
pub mod tray;

use std::sync::atomic::AtomicBool;
use std::sync::Mutex;

use shortcut::ShortcutSettings;
use translator::bing::BingProvider;
use translator::client::build_client;

/// Общее состояние приложения, доступное Tauri-командам.
pub struct AppState {
    pub http: reqwest::Client,
    pub bing: BingProvider,
    pub shortcuts: Mutex<ShortcutSettings>,
    pub is_pinned: AtomicBool,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let http = build_client().expect("не удалось создать HTTP-клиент");
    let state = AppState {
        http,
        bing: BingProvider::new(),
        shortcuts: Mutex::new(ShortcutSettings::default()),
        is_pinned: AtomicBool::new(false),
    };

    tauri::Builder::default()
        .manage(state)
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            if let Err(error) = shortcut::init(app.handle()) {
                eprintln!("Глобальные шорткаты недоступны: {error}");
            }
            tray::create_tray(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::translate_text,
            shortcut::update_global_shortcut,
            shortcut::set_window_pin
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
