use std::borrow::Cow;

use reqwest::{header, Client};

use super::client::{looks_like_captcha, response_error};
use super::models::TranslateError;

const TTS_ENDPOINT: &str = "https://translate.googleapis.com/translate_tts";
const MAX_CHUNK_CHARS: usize = 180;

/// Загружает MP3-озвучку текста через публичный эндпоинт Google TTS.
pub async fn fetch_tts_audio(
    client: &Client,
    text: &str,
    lang: &str,
) -> Result<Vec<u8>, TranslateError> {
    let text = text.trim();
    if text.is_empty() {
        return Err(TranslateError::InvalidRequest("текст пуст".to_string()));
    }

    let lang = lang.trim();
    let lang = if lang.is_empty() { "en" } else { lang };

    let mut audio = Vec::new();

    for chunk in split_text(text, MAX_CHUNK_CHARS) {
        let response = client
            .get(TTS_ENDPOINT)
            .query(&[
                ("ie", "UTF-8"),
                ("client", "gtx"),
                ("tl", lang),
                ("q", chunk.as_ref()),
            ])
            .header(header::REFERER, "https://translate.google.com/")
            .header(header::ACCEPT, "audio/mpeg,*/*")
            .send()
            .await?;

        let status = response.status();
        let bytes = response.bytes().await?;

        if !status.is_success() {
            let body = String::from_utf8_lossy(&bytes);
            return Err(response_error(status, &body));
        }
        if bytes.is_empty() {
            return Err(TranslateError::EmptyResponse);
        }

        let body_preview = String::from_utf8_lossy(&bytes[..bytes.len().min(512)]);
        if looks_like_captcha(&body_preview) {
            return Err(TranslateError::RateLimited);
        }

        audio.extend_from_slice(&bytes);
    }

    if audio.is_empty() {
        return Err(TranslateError::EmptyResponse);
    }

    Ok(audio)
}

/// Делит текст на части по словам, не превышая лимит эндпоинта.
fn split_text(text: &str, max_chars: usize) -> Vec<Cow<'_, str>> {
    if text.chars().count() <= max_chars {
        return vec![Cow::Borrowed(text)];
    }

    let mut chunks = Vec::new();
    let mut current = String::new();

    for word in text.split_inclusive(char::is_whitespace) {
        let word_len = word.chars().count();

        if !current.is_empty() && current.chars().count() + word_len > max_chars {
            chunks.push(Cow::Owned(current.trim_end().to_string()));
            current = String::new();
        }

        if word_len > max_chars {
            for ch in word.chars() {
                if current.chars().count() >= max_chars {
                    chunks.push(Cow::Owned(current.clone()));
                    current.clear();
                }
                current.push(ch);
            }
        } else {
            current.push_str(word);
        }
    }

    let tail = current.trim_end();
    if !tail.is_empty() {
        chunks.push(Cow::Owned(tail.to_string()));
    }

    chunks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_text_is_single_chunk() {
        assert_eq!(split_text("привет мир", 40), vec![Cow::Borrowed("привет мир")]);
    }

    #[test]
    fn long_text_is_split_without_exceeding_limit() {
        let text = "слово ".repeat(100);
        let chunks = split_text(&text, 50);

        assert!(chunks.len() > 1);
        assert!(chunks.iter().all(|chunk| chunk.chars().count() <= 50));
    }

    #[test]
    fn oversized_word_is_hard_split() {
        let word = "a".repeat(25);
        let chunks = split_text(&word, 10);

        assert_eq!(chunks.len(), 3);
        assert!(chunks.iter().all(|chunk| chunk.chars().count() <= 10));
    }

    #[tokio::test]
    #[ignore = "требуется доступ к интернету"]
    async fn fetches_mp3_bytes() {
        let client = crate::translator::client::build_client().expect("клиент создаётся");
        let audio = fetch_tts_audio(&client, "hello", "en")
            .await
            .expect("TTS должен вернуть аудио");

        assert!(audio.len() > 1024);
        assert!(
            audio.starts_with(b"ID3") || audio.starts_with(&[0xFF, 0xFB]) || audio.starts_with(&[0xFF, 0xF3]),
            "ожидался MP3-поток, получены байты: {:?}",
            &audio[..audio.len().min(8)]
        );
    }
}
