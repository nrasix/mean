use reqwest::{header, Client};
use serde::Deserialize;
use serde_json::Value;

use super::client::{looks_like_captcha, response_error};
use super::models::{
    truncate_body, DictionaryEntry, TranslateError, TranslationRequest, TranslationResponse,
};

const ENDPOINT: &str = "https://translate.googleapis.com/translate_a/single";
const CHROME_ENDPOINT: &str = "https://translate.googleapis.com/translate_a/t";

/// Провайдер Google Translate через публичный эндпоинт GTX.
#[derive(Debug, Clone, Copy, Default)]
pub struct GoogleProvider;

impl GoogleProvider {
    pub async fn translate(
        &self,
        client: &Client,
        request: &TranslationRequest,
    ) -> Result<TranslationResponse, TranslateError> {
        if request.text.trim().is_empty() {
            return Err(TranslateError::InvalidRequest("текст пуст".to_string()));
        }

        match self.translate_gtx(client, request).await {
            Ok(response) => Ok(response),
            Err(primary_error) => {
                // Google отдаёт 429 на client=gtx при не-браузерном TLS-отпечатке.
                // Extension-эндпоинт на том же хосте обычно остаётся доступным.
                match self.translate_chrome(client, request).await {
                    Ok(response) => Ok(response),
                    Err(error) => {
                        eprintln!(
                            "Google GTX недоступен ({primary_error}), extension-эндпоинт тоже: {error}"
                        );
                        Err(primary_error)
                    }
                }
            }
        }
    }

    async fn translate_gtx(
        &self,
        client: &Client,
        request: &TranslationRequest,
    ) -> Result<TranslationResponse, TranslateError> {
        let params = [
            ("client", "gtx"),
            ("sl", request.source_lang.as_str()),
            ("tl", request.target_lang.as_str()),
            ("dt", "t"),
            ("dt", "bd"),
            ("dt", "rm"),
            ("dj", "1"),
            ("q", request.text.as_str()),
        ];

        let body = send_google(client, ENDPOINT, &params).await?;
        let payload: GooglePayload = serde_json::from_str(&body)
            .map_err(|err| TranslateError::Parse(format!("{}: {}", err, truncate_body(&body))))?;

        let translated_text = payload
            .sentences
            .iter()
            .filter_map(|sentence| sentence.trans.as_deref())
            .collect::<String>()
            .trim()
            .to_string();

        if translated_text.is_empty() {
            return Err(TranslateError::EmptyResponse);
        }

        let phonetic = payload
            .sentences
            .iter()
            .filter_map(|sentence| sentence.src_translit.as_deref())
            .map(str::trim)
            .find(|value| !value.is_empty())
            .map(str::to_string);

        let dictionary = payload
            .dict
            .into_iter()
            .filter_map(|dict| {
                let terms: Vec<String> = dict
                    .terms
                    .into_iter()
                    .map(|term| term.trim().to_string())
                    .filter(|term| !term.is_empty())
                    .collect();

                let reverse_translations = dict
                    .entry
                    .into_iter()
                    .filter_map(|entry| {
                        let word = entry.word?.trim().to_string();
                        if word.is_empty() {
                            return None;
                        }

                        let reverse: Vec<String> = entry
                            .reverse_translation
                            .into_iter()
                            .map(|value| value.trim().to_string())
                            .filter(|value| !value.is_empty())
                            .collect();

                        Some((word, reverse))
                    })
                    .collect::<Vec<_>>();

                if terms.is_empty() && reverse_translations.is_empty() {
                    return None;
                }

                Some(DictionaryEntry {
                    part_of_speech: map_part_of_speech(dict.pos.as_deref().unwrap_or_default()),
                    terms,
                    reverse_translations,
                })
            })
            .collect();

        Ok(TranslationResponse {
            translated_text,
            detected_source_lang: payload.src.filter(|value| !value.is_empty()),
            phonetic,
            dictionary,
            provider: "Google".to_string(),
        })
    }

    async fn translate_chrome(
        &self,
        client: &Client,
        request: &TranslationRequest,
    ) -> Result<TranslationResponse, TranslateError> {
        let params = [
            ("client", "dict-chrome-ex"),
            ("sl", request.source_lang.as_str()),
            ("tl", request.target_lang.as_str()),
            ("q", request.text.as_str()),
        ];

        let body = send_google(client, CHROME_ENDPOINT, &params).await?;
        let payload: Value = serde_json::from_str(&body)
            .map_err(|err| TranslateError::Parse(format!("{}: {}", err, truncate_body(&body))))?;

        let (translated_text, detected_source_lang) = parse_chrome_payload(&payload);
        let translated_text = translated_text.trim().to_string();

        if translated_text.is_empty() {
            return Err(TranslateError::EmptyResponse);
        }

        Ok(TranslationResponse {
            translated_text,
            detected_source_lang,
            phonetic: None,
            dictionary: Vec::new(),
            provider: "Google".to_string(),
        })
    }
}

async fn send_google(
    client: &Client,
    endpoint: &str,
    params: &[(&str, &str)],
) -> Result<String, TranslateError> {
    let response = client
        .get(endpoint)
        .query(params)
        .header(header::REFERER, "https://translate.google.com/")
        .header(header::ORIGIN, "https://translate.google.com")
        .header(header::ACCEPT_LANGUAGE, "en-US,en;q=0.9")
        .header(header::ACCEPT, "*/*")
        .send()
        .await?;
    let status = response.status();
    let body = response.text().await?;

    if !status.is_success() {
        return Err(response_error(status, &body));
    }
    if looks_like_captcha(&body) {
        return Err(TranslateError::RateLimited);
    }
    if body.trim().is_empty() {
        return Err(TranslateError::EmptyResponse);
    }

    Ok(body)
}

/// Разбирает ответ extension-эндпоинта: `["текст"]` или `[["текст", "en"]]`.
fn parse_chrome_payload(payload: &Value) -> (String, Option<String>) {
    fn walk(value: &Value, text: &mut String, detected: &mut Option<String>) {
        match value {
            Value::String(segment) => push_segment(text, segment),
            Value::Array(items) => {
                if let [Value::String(segment), Value::String(lang)] = items.as_slice() {
                    if looks_like_language_code(lang) {
                        push_segment(text, segment);
                        if detected.is_none() {
                            *detected = Some(lang.clone());
                        }
                        return;
                    }
                }

                for item in items {
                    walk(item, text, detected);
                }
            }
            _ => {}
        }
    }

    fn push_segment(text: &mut String, segment: &str) {
        let segment = segment.trim();
        if segment.is_empty() {
            return;
        }
        if !text.is_empty() {
            text.push(' ');
        }
        text.push_str(segment);
    }

    let mut text = String::new();
    let mut detected = None;
    walk(payload, &mut text, &mut detected);
    (text, detected)
}

fn looks_like_language_code(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 8
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphabetic() || ch == '-')
}

fn map_part_of_speech(pos: &str) -> String {
    let pos = pos.trim();
    if pos.is_empty() {
        return "другое".to_string();
    }

    match pos.to_ascii_lowercase().as_str() {
        "noun" => "существительное",
        "verb" => "глагол",
        "adjective" => "прилагательное",
        "adverb" => "наречие",
        "pronoun" => "местоимение",
        "preposition" => "предлог",
        "conjunction" => "союз",
        "interjection" => "междометие",
        "numeral" => "числительное",
        "article" => "артикль",
        "particle" => "частица",
        _ => pos,
    }
    .to_string()
}

#[derive(Debug, Default, Deserialize)]
struct GooglePayload {
    #[serde(default)]
    sentences: Vec<GoogleSentence>,
    #[serde(default)]
    dict: Vec<GoogleDict>,
    #[serde(default)]
    src: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct GoogleSentence {
    #[serde(default)]
    trans: Option<String>,
    #[serde(default)]
    src_translit: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct GoogleDict {
    #[serde(default)]
    pos: Option<String>,
    #[serde(default)]
    terms: Vec<String>,
    #[serde(default)]
    entry: Vec<GoogleDictEntry>,
}

#[derive(Debug, Default, Deserialize)]
struct GoogleDictEntry {
    #[serde(default)]
    word: Option<String>,
    #[serde(default)]
    reverse_translation: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::translator::client::build_client;
    use crate::translator::models::ProviderType;

    #[test]
    fn parses_chrome_payload_with_detected_language() {
        let payload: Value = serde_json::from_str(r#"[["Привет, мир. Как вы?","en"]]"#).unwrap();
        let (text, detected) = parse_chrome_payload(&payload);
        assert_eq!(text, "Привет, мир. Как вы?");
        assert_eq!(detected.as_deref(), Some("en"));
    }

    #[test]
    fn parses_flat_chrome_payload() {
        let payload: Value =
            serde_json::from_str(r#"["Быстрая бурая лиса. Это второе предложение."]"#).unwrap();
        let (text, detected) = parse_chrome_payload(&payload);
        assert_eq!(text, "Быстрая бурая лиса. Это второе предложение.");
        assert_eq!(detected, None);
    }

    #[tokio::test]
    #[ignore = "требуется доступ к интернету и отсутствие rate-limit Google"]
    async fn google_gtx_translates_run_with_dictionary() {
        let client = build_client().expect("HTTP-клиент должен создаваться");
        let request = TranslationRequest {
            text: "run".to_string(),
            source_lang: "en".to_string(),
            target_lang: "ru".to_string(),
            provider: ProviderType::Google,
        };

        let response = GoogleProvider
            .translate_gtx(&client, &request)
            .await
            .expect("Google GTX должен вернуть перевод");

        let has_expected_translation = response.translated_text.contains("бежать")
            || response
                .dictionary
                .iter()
                .flat_map(|entry| entry.terms.iter())
                .any(|term| term.contains("бежать"));

        assert!(
            has_expected_translation,
            "ожидался перевод «бежать», получено: {:?}",
            response.translated_text
        );
        assert!(
            !response.dictionary.is_empty(),
            "массив dictionary не должен быть пустым"
        );
    }

    #[tokio::test]
    #[ignore = "требуется доступ к интернету"]
    async fn google_translates_through_fallback_when_gtx_is_blocked() {
        let client = build_client().expect("HTTP-клиент должен создаваться");
        let request = TranslationRequest {
            text: "hello".to_string(),
            source_lang: "auto".to_string(),
            target_lang: "ru".to_string(),
            provider: ProviderType::Google,
        };

        let response = GoogleProvider
            .translate(&client, &request)
            .await
            .expect("Google должен вернуть перевод хотя бы через extension-эндпоинт");

        assert!(
            response.translated_text.to_lowercase().contains("привет"),
            "ожидался перевод «привет», получено: {:?}",
            response.translated_text
        );
        assert_eq!(response.detected_source_lang.as_deref(), Some("en"));
    }
}
