use reqwest::Client;
use serde::Deserialize;

use super::client::{looks_like_captcha, response_error};
use super::models::{
    truncate_body, DictionaryEntry, TranslateError, TranslationRequest, TranslationResponse,
};

const ENDPOINT: &str = "https://translate.googleapis.com/translate_a/single";

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

        let response = client.get(ENDPOINT).query(&params).send().await?;
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

        let payload: GooglePayload = serde_json::from_str(&body).map_err(|err| {
            TranslateError::Parse(format!("{}: {}", err, truncate_body(&body)))
        })?;

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
            provider: "Google GTX".to_string(),
        })
    }
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

    #[tokio::test]
    async fn google_translates_run_with_dictionary() {
        let client = build_client().expect("HTTP-клиент должен создаваться");
        let request = TranslationRequest {
            text: "run".to_string(),
            source_lang: "en".to_string(),
            target_lang: "ru".to_string(),
            provider: ProviderType::Google,
        };

        let response = GoogleProvider
            .translate(&client, &request)
            .await
            .expect("Google должен вернуть перевод");

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
}
