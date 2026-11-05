use tauri::State;

use crate::translator::google::GoogleProvider;
use crate::translator::models::{ProviderType, TranslationRequest, TranslationResponse};
use crate::AppState;

const AUTO: &str = "auto";

/// Переводит текст выбранным провайдером.
///
/// Если `target_lang == "auto"`, целевой язык выбирается по алфавиту текста:
/// кириллица → английский, всё остальное → русский.
#[tauri::command]
pub async fn translate_text(
    text: String,
    source_lang: Option<String>,
    target_lang: Option<String>,
    provider: Option<String>,
    state: State<'_, AppState>,
) -> Result<TranslationResponse, String> {
    let text = text.trim().to_string();
    if text.is_empty() {
        return Err("Текст для перевода пуст".to_string());
    }

    let source_lang = normalize_lang(source_lang.as_deref().unwrap_or(AUTO));
    let target_lang = normalize_lang(target_lang.as_deref().unwrap_or(AUTO));

    let target_lang = if target_lang == AUTO {
        if contains_cyrillic(&text) {
            "en".to_string()
        } else {
            "ru".to_string()
        }
    } else {
        target_lang
    };

    let provider = parse_provider(provider.as_deref());

    let request = TranslationRequest {
        text,
        source_lang,
        target_lang,
        provider,
    };

    let response = match provider {
        ProviderType::Google => GoogleProvider.translate(&state.http, &request).await,
        ProviderType::Bing => state.bing.translate(&state.http, &request).await,
    };

    response.map_err(|err| err.to_string())
}

fn normalize_lang(value: &str) -> String {
    let value = value.trim().to_lowercase();
    if value.is_empty() {
        AUTO.to_string()
    } else {
        value
    }
}

fn parse_provider(value: Option<&str>) -> ProviderType {
    match value.unwrap_or_default().trim().to_lowercase().as_str() {
        "bing" => ProviderType::Bing,
        _ => ProviderType::Google,
    }
}

fn contains_cyrillic(text: &str) -> bool {
    text.chars()
        .any(|ch| matches!(ch, '\u{0400}'..='\u{04FF}'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cyrillic_text_targets_english() {
        assert!(contains_cyrillic("привет, мир"));
        assert!(!contains_cyrillic("hello, world"));
    }

    #[test]
    fn provider_is_parsed_case_insensitively() {
        assert_eq!(parse_provider(Some("Bing")), ProviderType::Bing);
        assert_eq!(parse_provider(Some("google")), ProviderType::Google);
        assert_eq!(parse_provider(None), ProviderType::Google);
    }
}
