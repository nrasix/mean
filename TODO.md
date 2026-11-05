TODO: Разработка кроссплатформенного лаунчера-переводчика (Tauri v2 + React)

Референс вот этот репозиторий, который является расширением для PowerToys, но логику можно и перенести в свой лаунчер-переводчик - https://github.com/poychang/CmdPalTranslator

Инструкция для AI-агента:

Выполняй задачи строго последовательно от Этапа 1 к Этапу 6. После завершения каждого шага проверяй условие из блока Критерий готовности (Verification) и отмечай чекбокс [x].

Ключевые архитектурные правила:

Все HTTP-запросы к публичным веб-эндпоинтам переводчиков (Google, Bing) должны выполняться исключительно на стороне Rust-бэкенда через reqwest. Выполнение запросов из WebView (React) приведёт к блокировке по CORS и невозможности подменить заголовки User-Agent / Referer.

Приложение работает в фоновом режиме (Stealth Launcher) и мгновенно открывается поверх всех окон по системному глобальному шорткату с автоматической установкой фокуса в поле ввода.

Стек технологий и архитектура

Ядро и системный слой: Tauri v2 (Rust)

Фронтенд: React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons

HTTP-клиент (Rust): reqwest (с поддержкой json, gzip, cookies)

Плагины Tauri v2:

tauri-plugin-global-shortcut — перехват глобальных шорткатов ОС для мгновенного открытия окна поверх любых программ и перевода выделенного текста

tauri-plugin-clipboard-manager — копирование перевода по Enter и чтение буфера обмена при вызове по шорткату

tauri-plugin-store — локальное сохранение настроек (выбранный провайдер, языки, пользовательские шорткаты)

tauri-plugin-positioner (опционально) — позиционирование окна по центру активного монитора, где находится курсор мыши

tauri-plugin-autostart — автозапуск в фоновом режиме вместе с ОС (Windows / macOS / Linux)

Этап 1: Инициализация проекта и настройка зависимостей

[x] Шаг 1.1: Создание каркаса Tauri v2 + React (TypeScript)

Инициализировать проект с шаблоном react-ts через Vite и Tauri v2 CLI.

Установить и настроить Tailwind CSS и пакет иконок lucide-react.

Очистить шаблонный код в src/App.tsx и src-tauri/src/lib.rs.

[x] Шаг 1.2: Подключение Rust-зависимостей (src-tauri/Cargo.toml)

Добавить крейты для сетевых запросов и асинхронности:

reqwest = { version = "0.12", features = ["json", "gzip", "cookies", "rustls-tls"] }

tokio = { version = "1", features = ["full"] }

serde = { version = "1", features = ["derive"] }

serde_json = "1"

thiserror = "2"

regex = "1" (для парсинга веб-токена со страницы Bing Translator)

Добавить официальные плагины Tauri v2:

tauri-plugin-global-shortcut

tauri-plugin-clipboard-manager

tauri-plugin-store

[x] Шаг 1.3: Установка NPM-пакетов для фронтенд-биндингов (package.json)

Установить @tauri-apps/api, @tauri-apps/plugin-global-shortcut, @tauri-apps/plugin-clipboard-manager, @tauri-apps/plugin-store.

[x] Шаг 1.4: Настройка прав доступа (src-tauri/capabilities/default.json)

Прописать разрешения для управления окном (core:window:allow-show, core:window:allow-hide, core:window:allow-set-focus, core:window:allow-unminimize, core:window:allow-set-size, core:window:allow-start-dragging), буфера обмена (clipboard-manager:allow-write-text, clipboard-manager:allow-read-text), глобальных шорткатов (global-shortcut:allow-register, global-shortcut:allow-unregister, global-shortcut:allow-is-registered) и хранилища (store:default).

Критерий готовности Этапа 1: Команда cargo check в папке src-tauri и npm run build в корне проекта завершаются без ошибок.

Этап 2: Архитектура переводчиков на Rust (Ядро без API-ключей)

[x] Шаг 2.1: Проектирование единых моделей данных (src-tauri/src/translator/models.rs)

Создать структуры, сериализуемые через #[derive(Serialize, Deserialize, Debug, Clone)]:

TranslationRequest: text: String, source_lang: String (например, "auto"), target_lang: String (например, "ru" или "en"), provider: ProviderType.

DictionaryEntry: part_of_speech: String (существительное, глагол и т.д.), terms: Vec<String>, reverse_translations: Vec<(String, Vec<String>)>.

TranslationResponse: translated_text: String, detected_source_lang: Option<String>, phonetic: Option<String>, dictionary: Vec<DictionaryEntry>, provider: String.

[x] Шаг 2.2: Создание общего HTTP-клиента (src-tauri/src/translator/client.rs)

Инициализировать синглтон или управляемое состояние reqwest::Client с:

User-Agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

Включённым cookie_store(true) и gzip(true)

Таймаутом запроса 10 секунд.

[x] Шаг 2.3: Реализация провайдера Google Translate (src-tauri/src/translator/google.rs)

Сформировать GET-запрос к https://translate.googleapis.com/translate_a/single.

Передать query-параметры:

client=gtx

sl={source_lang}

tl={target_lang}

dt=t (перевод предложений)

dt=bd (словарь и части речи)

dt=rm (транслитерация / фонетическое чтение)

dj=1 (возврат структурированного JSON вместо вложенных массивов)

q={text}

Десериализовать JSON-ответ: склеить все элементы sentences[].trans в translated_text, извлечь sentences[].src_translit в phonetic, а массив dict[] преобразовать в Vec<DictionaryEntry>.

[x] Шаг 2.4: Реализация резервного провайдера Bing Translator (src-tauri/src/translator/bing.rs)

Реализовать структуру BingTokenCache (защищённую tokio::sync::RwLock) для хранения параметров сессии (ig, iid, key, token, expiry).

Написать метод получения/обновления токена:

Выполнить GET https://www.bing.com/translator.

Извлечь регулярными выражениями из HTML значения IG:"...", data-iid="..." и массив params_AbusePreventionHelper = [key, "token", 3600000].

Написать метод перевода:

Отправить POST https://www.bing.com/ttranslatev3?isVertical=1&IG={ig}&IID={iid} с form-urlencoded телом: fromLang={source}, to={target}, text={text}, token={token}, key={key}.

Если получен статус 401 или пустой ответ — сбросить кэш токена, запросить новый токен и повторить запрос 1 раз.

[x] Шаг 2.5: Регистрация Tauri-команды (src-tauri/src/commands.rs)

Создать асинхронную команду #[tauri::command] pub async fn translate_text(...) -> Result<TranslationResponse, String>.

Реализовать умное автоопределение целевого языка (как в CmdPalTranslator): если target_lang == "auto", проверять, содержит ли входной текст кириллицу (или основной язык пользователя). Если текст на русском — переводить на английский (en), иначе — на русский (ru).

Критерий готовности Этапа 2: Написан unit-тест в Rust (cargo test), который успешно отправляет тестовый запрос со словом "run" через GoogleProvider, получает перевод "бежать" и непустой массив словарных статей dictionary.

Этап 3: Вызов окна по глобальному шорткату и работа в стиле Spotlight / Command Palette

[x] Шаг 3.1: Конфигурация безрамочного плавающего окна (src-tauri/tauri.conf.json)

Настроить главное окно (main):

width: 680, height: 440

decorations: false (без системной рамки и заголовка)

transparent: true (прозрачный фон для скруглённых углов и тени)

alwaysOnTop: true (поверх всех окон)

center: true (по центру экрана)

skipTaskbar: true (не загромождать панель задач)

visible: false (при старте приложение работает тихо в фоне и ждёт нажатия шортката)

[x] Шаг 3.2: Менеджер глобальных шорткатов и логика открытия (src-tauri/src/shortcut.rs)

Подключить tauri_plugin_global_shortcut и обрабатывать состояние клавиши только на ShortcutState::Pressed (чтобы избежать двойного срабатывания при отпускании Released).

Шорткат №1 — Быстрое открытие лаунчера (Shift+Alt+T по умолчанию, CommandOrControl+Shift+Space как резервный):

Проверить состояние окна (window.is_visible() и window.is_focused()).

Если окно скрыто или не в фокусе:

Вызвать window.unminimize(), window.show(), window.set_focus().

Отправить во фронтенд событие app:shortcut-opened (чтобы React мгновенно поставил курсор в <textarea> и выделил предыдущий текст для быстрого ввода поверх него).

Если окно уже открыто и находится в фокусе:

Скрыть окно (window.hide()), вернув фокус предыдущему активному приложению ОС.

Шорткат №2 — Открытие с мгновенным переводом буфера обмена (CommandOrControl+Shift+T):

Считать текст из системного буфера обмена на стороне Rust.

Показать и сфокусировать окно переводчика.

Отправить событие app:translate-clipboard с текстом из буфера во фронтенд для моментального запуска перевода без лишнего нажатия Ctrl+V.

Динамическая перерегистрация шортката:

Создать Tauri-команду update_global_shortcut(old_shortcut: String, new_shortcut: String) -> Result<(), String>, которая снимает старый хоткей (unregister) и регистрирует новый (register) на лету без перезапуска приложения.

[x] Шаг 3.3: Автоскрытие при потере фокуса и кнопка закрепления (Pin)

Подписаться на системное событие окна WindowEvent::Focused(false): автоматически вызывать window.hide() при клике мышью вне окна переводчика или переключении через Alt+Tab.

Добавить в Rust-состояние флаг is_pinned: AtomicBool (управляемый командой set_window_pin(pinned: bool)), чтобы пользователь мог временно закрепить окно поверх всех программ и отключить автоскрытие при потере фокуса.

[x] Шаг 3.4: Настройка системного трея (src-tauri/src/tray.rs)

Добавить иконку приложения в системный трей (System Tray / Menu Bar).

По левому клику на иконку трея — вызывать ту же функцию переключения окна (toggle_translator_window), что и по глобальному шорткату.

Добавить контекстное меню трея с пунктами:

Открыть переводчик (Shift+Alt+T)

Настройки шорткатов и провайдеров

Выход (app.exit(0))

Критерий готовности Этапа 3: При запуске npm run tauri dev приложение стартует скрытым в трее. Нажатие Shift+Alt+T в любом другом приложении (браузере, IDE, блокноте) мгновенно открывает окно переводчика поверх экрана с активным курсором ввода. Повторное нажатие Shift+Alt+T, клавиша Escape или клик мимо окна мгновенно скрывают его.

Этап 4: Разработка пользовательского интерфейса (React + Tailwind)

[x] Шаг 4.1: Слушатель событий шортката и автофокус (src/hooks/useWindowShortcutEvents.ts)

Подписаться через listen('app:shortcut-opened', ...) на событие открытия окна по шорткату.

При получении события вызывать inputRef.current?.focus() и inputRef.current?.select(), чтобы пользователь мог сразу печатать новый текст после нажатия шортката, не стирая старый вручную.

Добавить глобальный обработчик keydown внутри окна: нажатие Escape вызывает getCurrentWindow().hide().

[x] Шаг 4.2: Хук useDebounce и защита от спама запросов (src/hooks/useDebounce.ts)

Реализовать хук задержки ввода (по умолчанию 300 мс).

Использовать проверку актуальности requestId, чтобы ответы от старых запросов не перезаписывали более свежие результаты.

[x] Шаг 4.3: Верхняя панель ввода и выбора языков (src/components/SearchBar.tsx)

Создать область перетаскивания окна (data-tauri-drag-region).

Реализовать автофокусируемое поле ввода (textarea с автовысотой до 3 строк).

Добавить компактный переключатель языковой пары (Auto -> RU/EN, кнопка быстрой смены языков местами Swap, выбор провайдера Google / Bing) и иконку булавки (Pin) для закрепления окна.

Добавить индикатор загрузки (тонкий пульсирующий лоадер при выполнении запроса).

[x] Шаг 4.4: Карточка основного перевода и словаря (src/components/ResultList.tsx)

Блок 1 (Основной перевод): крупный читаемый текст перевода, бейдж определённого исходного языка (например, EN -> RU), транскрипция (phonetic) и кнопка копирования.

Блок 2 (Словарь по частям речи): если dictionary.length > 0, отображать сгруппированный список по частям речи (глагол, существительное, прилагательное) с чипсами синонимов и обратным переводом (как в CmdPalTranslator).

Каждый элемент списка должен поддерживать выбор стрелками клавиатуры ↑ / ↓ и копирование в буфер обмена по нажатию Enter с последующим скрытием окна.

[x] Шаг 4.5: Нижняя строка состояния с подсказками хоткеев (src/components/Footer.tsx)

Отобразить статус активного провайдера (Google GTX / Bing Web) и шорткаты:

Shift+Alt+T — Показать / Скрыть

Enter — Скопировать и закрыть

Ctrl+C — Скопировать без закрытия

Tab — Сменить провайдера

Esc — Скрыть окно

Критерий готовности Этапа 4: Полный цикл работы без мыши: пользователь нажимает шорткат -> сразу печатает слово -> через 300 мс видит перевод и словарь -> нажимает Enter -> перевод копируется в буфер обмена, а окно автоматически скрывается.

Этап 5: Продвинутые функции (Рекордер шорткатов, Озвучка TTS, Настройки)

[x] Шаг 5.1: Бесплатная озвучка текста (TTS) через Google (src-tauri/src/translator/tts.rs)

Реализовать Tauri-команду fetch_tts_audio(text: String, lang: String) -> Result<Vec<u8>, String>, которая обращается к публичному эндпоинту:
https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl={lang}&q={text}

Возвращать массив байтов MP3 во фронтенд и воспроизводить через браузерный Audio по нажатию Ctrl+Enter или клику на иконку динамика.

[x] Шаг 5.2: Интерактивный рекордер шорткатов в настройках (src/components/ShortcutRecorder.tsx)

Создать поле «Нажмите сочетание клавиш...», которое перехватывает комбинацию модификаторов (Ctrl, Alt, Shift, Meta/Cmd) + основную клавишу (Space, T, Q и т.д.).

Проверять доступность шортката в системе и вызывать Rust-команду update_global_shortcut для мгновенного применения нового хоткея.

[x] Шаг 5.3: Окно/вкладка настроек (src/components/SettingsModal.tsx)

Сохранение конфигурации через @tauri-apps/plugin-store в файл settings.json:

Глобальный шорткат вызова окна (по умолчанию Shift+Alt+T)

Глобальный шорткат перевода буфера обмена (по умолчанию CommandOrControl+Shift+T)

Опция «Автоматически переводить буфер обмена при открытии по основному шорткату»

Провайдер по умолчанию (Google / Bing)

Основной родной язык и второй целевой язык (для режима Auto)

Задержка debounce (от 150 до 800 мс)

Критерий готовности Этапа 5: Пользователь может изменить шорткат открытия в настройках (например, с Shift+Alt+T на Ctrl+Shift+Space), и новое сочетание клавиш сразу начинает открывать приложение.

Этап 6: Обработка ошибок, Rate-Limiting и Кроссплатформенная сборка

[x] Шаг 6.1: Автоматический Fallback при ошибке 429 Too Many Requests

В Rust-команде translate_text: если выбран Google, но сервер вернул статус 429 или капчу, автоматически выполнять повторный запрос через BingProvider и помечать в ответе provider: "Bing (Fallback)".

[x] Шаг 6.2: Адаптация шорткатов и поведения окна под особенности ОС (Windows, macOS, Linux)

macOS: настроить ActivationPolicy::Accessory в lib.rs, чтобы приложение не занимало место в Dock и могло открываться по шорткату поверх полноэкранных (Full Screen) приложений без переключения рабочего стола.

Windows: использовать трюк с кратковременным сбросом/установкой always_on_top при вызове set_focus(), чтобы гарантированно обходить ограничение Windows SetForegroundWindow при вызове из фонового процесса по шорткату.

Linux: проверить регистрацию глобальных шорткатов в X11 и добавить подсказку для пользователей Wayland (при необходимости привязки через системные шорткаты DE к команде запуска с флагом --toggle).

[x] Шаг 6.3: Финальная сборка и CI/CD (.github/workflows/release.yml)

Проверить локальную релизную сборку через npm run tauri build.

Настроить GitHub Actions с использованием tauri-apps/tauri-action для автоматической компиляции инсталляторов под Windows (.msi, .exe), macOS (.dmg, .app) и Linux (.deb, .AppImage).

Критерий готовности Этапа 6: Приложение успешно собирается в релизный бинарный файл объёмом ~8–12 МБ, висит в фоне с минимальным потреблением памяти, мгновенно вызывается по глобальному шорткату поверх любых окон и работает без API-ключей.