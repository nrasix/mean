use serde::{Deserialize, Serialize};

/// Провайдер перевода, выбранный пользователем.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ProviderType {
    #[default]
    Google,
    Bing,
}

/// Запрос на перевод, общий для всех провайдеров.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationRequest {
    pub text: String,
    pub source_lang: String,
    pub target_lang: String,
    pub provider: ProviderType,
}

/// Статья словаря: часть речи, переводы и обратный перевод.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct DictionaryEntry {
    pub part_of_speech: String,
    pub terms: Vec<String>,
    pub reverse_translations: Vec<(String, Vec<String>)>,
}

/// Нормализованный ответ переводчика, не зависящий от провайдера.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TranslationResponse {
    pub translated_text: String,
    pub detected_source_lang: Option<String>,
    pub phonetic: Option<String>,
    pub dictionary: Vec<DictionaryEntry>,
    pub provider: String,
}

/// Ошибки слоя переводчиков.
#[derive(Debug, thiserror::Error)]
pub enum TranslateError {
    #[error("сетевой запрос не удался: {0}")]
    Network(#[from] reqwest::Error),

    #[error("провайдер вернул статус {status}: {body}")]
    HttpStatus { status: u16, body: String },

    #[error("провайдер ограничил частоту запросов")]
    RateLimited,

    #[error("не удалось разобрать ответ провайдера: {0}")]
    Parse(String),

    #[error("провайдер вернул пустой ответ")]
    EmptyResponse,

    #[error("некорректный запрос: {0}")]
    InvalidRequest(String),
}

/// Короткая версия тела ответа для сообщений об ошибках.
pub fn truncate_body(body: &str) -> String {
    const MAX_CHARS: usize = 300;

    let cleaned = body.replace('\n', " ").replace('\r', " ");
    if cleaned.chars().count() <= MAX_CHARS {
        cleaned
    } else {
        let mut truncated: String = cleaned.chars().take(MAX_CHARS).collect();
        truncated.push('…');
        truncated
    }
}
