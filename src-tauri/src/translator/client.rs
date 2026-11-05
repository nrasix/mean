use std::time::Duration;

use reqwest::{Client, StatusCode};

use super::models::{truncate_body, TranslateError};

pub const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/// Общий HTTP-клиент для всех провайдеров.
pub fn build_client() -> Result<Client, reqwest::Error> {
    Client::builder()
        .user_agent(USER_AGENT)
        .cookie_store(true)
        .gzip(true)
        .timeout(Duration::from_secs(10))
        .build()
}

/// Преобразует HTTP-статус в доменную ошибку.
pub fn response_error(status: StatusCode, body: &str) -> TranslateError {
    if status == StatusCode::TOO_MANY_REQUESTS {
        TranslateError::RateLimited
    } else {
        TranslateError::HttpStatus {
            status: status.as_u16(),
            body: truncate_body(body),
        }
    }
}

/// Провайдеры отвечают HTML-капчей вместо JSON при подозрительной активности.
pub fn looks_like_captcha(body: &str) -> bool {
    let lower = body.to_ascii_lowercase();
    lower.contains("unusual traffic")
        || lower.contains("/sorry/")
        || lower.contains("g-recaptcha")
        || lower.contains("data-sitekey")
        || lower.contains("id=\"captcha")
}
