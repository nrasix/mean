use std::sync::Arc;
use std::time::{Duration, Instant};

use reqwest::{header, Client, StatusCode};
use regex::Regex;
use serde::Deserialize;
use tokio::sync::RwLock;

use super::client::{looks_like_captcha, response_error};
use super::models::{
    truncate_body, TranslateError, TranslationRequest, TranslationResponse,
};

const TRANSLATOR_PAGE: &str = "https://www.bing.com/translator";
const TRANSLATE_ENDPOINT: &str = "https://www.bing.com/ttranslatev3";

/// Параметры сессии Bing Translator, полученные со страницы переводчика.
#[derive(Debug, Clone)]
struct BingToken {
    ig: String,
    iid: String,
    key: String,
    token: String,
    expires_at: Instant,
}

/// Резервный провайдер Bing с кэшем токена.
#[derive(Debug, Clone, Default)]
pub struct BingProvider {
    cache: Arc<RwLock<Option<BingToken>>>,
}

impl BingProvider {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn translate(
        &self,
        client: &Client,
        request: &TranslationRequest,
    ) -> Result<TranslationResponse, TranslateError> {
        if request.text.trim().is_empty() {
            return Err(TranslateError::InvalidRequest("текст пуст".to_string()));
        }

        for attempt in 0..2 {
            let token = self.token(client, attempt > 0).await?;

            let from_lang = if request.source_lang.eq_ignore_ascii_case("auto") {
                "auto-detect"
            } else {
                request.source_lang.as_str()
            };

            let response = client
                .post(TRANSLATE_ENDPOINT)
                .query(&[
                    ("isVertical", "1"),
                    ("IG", token.ig.as_str()),
                    ("IID", token.iid.as_str()),
                ])
                .header(header::REFERER, TRANSLATOR_PAGE)
                .header(header::ORIGIN, "https://www.bing.com")
                .header(header::ACCEPT, "application/json")
                .form(&[
                    ("fromLang", from_lang),
                    ("to", request.target_lang.as_str()),
                    ("text", request.text.as_str()),
                    ("token", token.token.as_str()),
                    ("key", token.key.as_str()),
                ])
                .send()
                .await?;

            let status = response.status();
            let body = response.text().await?;

            let token_is_stale = status == StatusCode::UNAUTHORIZED
                || status == StatusCode::FORBIDDEN
                || (status.is_success() && body.trim().is_empty());

            if token_is_stale {
                self.invalidate_cache().await;
                if attempt == 0 {
                    continue;
                }
            }

            if !status.is_success() {
                return Err(response_error(status, &body));
            }
            if looks_like_captcha(&body) {
                return Err(TranslateError::RateLimited);
            }
            if body.trim().is_empty() {
                return Err(TranslateError::EmptyResponse);
            }

            return Self::parse_response(&body);
        }

        Err(TranslateError::EmptyResponse)
    }

    async fn invalidate_cache(&self) {
        self.cache.write().await.take();
    }

    async fn token(
        &self,
        client: &Client,
        force_refresh: bool,
    ) -> Result<BingToken, TranslateError> {
        if !force_refresh {
            let cached = {
                let guard = self.cache.read().await;
                guard.as_ref().cloned()
            };

            if let Some(token) = cached {
                if token.expires_at > Instant::now() + Duration::from_secs(60) {
                    return Ok(token);
                }
            }
        }

        let token = self.fetch_token(client).await?;
        *self.cache.write().await = Some(token.clone());
        Ok(token)
    }

    async fn fetch_token(&self, client: &Client) -> Result<BingToken, TranslateError> {
        let response = client
            .get(TRANSLATOR_PAGE)
            .header(
                header::ACCEPT,
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            )
            .header(header::ACCEPT_LANGUAGE, "en-US,en;q=0.9")
            .send()
            .await?;

        let status = response.status();
        let html = response.text().await?;

        if !status.is_success() {
            return Err(response_error(status, &html));
        }

        Self::parse_token(&html)
    }

    fn parse_token(html: &str) -> Result<BingToken, TranslateError> {
        let ig_re = Regex::new(r#"IG\s*:\s*"([^"]+)""#)
            .map_err(|err| TranslateError::Parse(err.to_string()))?;
        let iid_re = Regex::new(r#"data-iid="([^"]+)""#)
            .map_err(|err| TranslateError::Parse(err.to_string()))?;
        let abuse_re = Regex::new(
            r#"params_AbusePreventionHelper\s*=\s*\[\s*(\d+)\s*,\s*"([^"]+)"\s*,\s*(\d+)\s*\]"#,
        )
        .map_err(|err| TranslateError::Parse(err.to_string()))?;

        let ig = ig_re
            .captures(html)
            .and_then(|caps| caps.get(1))
            .map(|value| value.as_str().to_string())
            .ok_or_else(|| TranslateError::Parse("не найден параметр IG".to_string()))?;

        let iid = iid_re
            .captures(html)
            .and_then(|caps| caps.get(1))
            .map(|value| value.as_str().to_string())
            .ok_or_else(|| TranslateError::Parse("не найден параметр IID".to_string()))?;

        let abuse = abuse_re
            .captures(html)
            .ok_or_else(|| {
                TranslateError::Parse("не найден params_AbusePreventionHelper".to_string())
            })?;

        let key = abuse[1].to_string();
        let token = abuse[2].to_string();
        let validity_ms = abuse[3]
            .parse::<u64>()
            .map_err(|err| TranslateError::Parse(format!("некорректный срок жизни токена: {err}")))?;

        Ok(BingToken {
            ig,
            iid,
            key,
            token,
            expires_at: Instant::now() + Duration::from_millis(validity_ms),
        })
    }

    fn parse_response(body: &str) -> Result<TranslationResponse, TranslateError> {
        let payload: Vec<BingTranslationItem> = serde_json::from_str(body)
            .or_else(|_| {
                serde_json::from_str::<BingTranslationItem>(body).map(|item| vec![item])
            })
            .map_err(|err| {
                TranslateError::Parse(format!("{}: {}", err, truncate_body(body)))
            })?;

        let first = payload.first().ok_or(TranslateError::EmptyResponse)?;
        let translation = first
            .translations
            .first()
            .ok_or(TranslateError::EmptyResponse)?;

        let translated_text = translation
            .text
            .as_deref()
            .unwrap_or_default()
            .trim()
            .to_string();

        if translated_text.is_empty() {
            return Err(TranslateError::EmptyResponse);
        }

        let phonetic = translation
            .transliteration
            .as_ref()
            .and_then(|value| value.text.as_deref())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);

        Ok(TranslationResponse {
            translated_text,
            detected_source_lang: first
                .detected_language
                .as_ref()
                .and_then(|value| value.language.clone())
                .filter(|value| !value.is_empty()),
            phonetic,
            dictionary: Vec::new(),
            provider: "Bing".to_string(),
        })
    }
}

#[derive(Debug, Default, Deserialize)]
struct BingTranslationItem {
    #[serde(default, rename = "detectedLanguage")]
    detected_language: Option<BingDetectedLanguage>,
    #[serde(default)]
    translations: Vec<BingTranslation>,
}

#[derive(Debug, Default, Deserialize)]
struct BingDetectedLanguage {
    #[serde(default)]
    language: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct BingTranslation {
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    transliteration: Option<BingTransliteration>,
}

#[derive(Debug, Default, Deserialize)]
struct BingTransliteration {
    #[serde(default)]
    text: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_session_token_from_html() {
        let html = r#"
            <script>IG:"ABC123DEF";</script>
            <div data-iid="translator.5028"></div>
            <script>
                var params_AbusePreventionHelper = [1712345678,"token-xyz",3600000];
            </script>
        "#;

        let token = BingProvider::parse_token(html).expect("токен должен извлекаться");

        assert_eq!(token.ig, "ABC123DEF");
        assert_eq!(token.iid, "translator.5028");
        assert_eq!(token.key, "1712345678");
        assert_eq!(token.token, "token-xyz");
        assert!(token.expires_at > Instant::now());
    }

    #[test]
    fn parses_translation_response() {
        let body = r#"[{"detectedLanguage":{"language":"en"},"translations":[{"text":"бежать","to":"ru","transliteration":{"script":"Latn","text":"rʌn"}}]}]"#;

        let response = BingProvider::parse_response(body).expect("ответ должен разбираться");

        assert_eq!(response.translated_text, "бежать");
        assert_eq!(response.detected_source_lang.as_deref(), Some("en"));
        assert_eq!(response.phonetic.as_deref(), Some("rʌn"));
        assert_eq!(response.provider, "Bing");
    }
}
