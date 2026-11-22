use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

#[derive(Serialize)]
pub struct MusicTarget { url: String, matched: bool, title: Option<String> }

fn video_info(html: &str) -> Option<(String, String)> {
    let tail = html.split_once("var ytInitialData = ")?.1;
    let data = Value::deserialize(&mut serde_json::Deserializer::from_str(tail)).ok()?;
    let sections = data.pointer("/contents/twoColumnSearchResultsRenderer/primaryContents/sectionListRenderer/contents")?.as_array()?;
    for section in sections {
        if let Some(items) = section.pointer("/itemSectionRenderer/contents").and_then(Value::as_array) {
            for item in items {
                if let Some(renderer) = item.get("videoRenderer") {
                    if let Some(id) = renderer.get("videoId").and_then(Value::as_str) {
                        if id.len() == 11 && id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-') {
                            let Some(title) = renderer.pointer("/title/simpleText").and_then(Value::as_str).map(str::to_owned)
                                .or_else(|| renderer.pointer("/title/runs").and_then(Value::as_array).map(|runs| runs.iter().filter_map(|run| run.get("text").and_then(Value::as_str)).collect::<String>())) else { continue };
                            if !title.trim().is_empty() { return Some((id.into(), title)); }
                        }
                    }
                }
            }
        }
    }
    None
}

fn search(query: &str) -> Result<MusicTarget, String> {
    let query = query.trim();
    if query.is_empty() || query.chars().count() > 240 { return Err("Provide a song title under 240 characters.".into()); }
    let mut url = url::Url::parse("https://www.youtube.com/results").unwrap();
    url.query_pairs_mut().append_pair("search_query", &format!("{query} music"));
    // YouTube's page format can change or show consent; fall back to its search page.
    let video = reqwest::blocking::Client::builder().timeout(Duration::from_secs(12)).build().ok()
        .and_then(|client| client.get(url.clone()).send().ok())
        .and_then(|response| response.error_for_status().ok())
        .and_then(|response| response.text().ok()).and_then(|html| video_info(&html));
    Ok(match video {
        Some((id, title)) => MusicTarget { url: format!("https://www.youtube.com/watch?v={id}&autoplay=1"), matched: true, title: Some(title) },
        None => MusicTarget { url: url.to_string(), matched: false, title: None },
    })
}

#[tauri::command]
pub async fn resolve_youtube_music(query: String) -> Result<MusicTarget, String> {
    tauri::async_runtime::spawn_blocking(move || search(&query)).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn selects_video_only_from_search_results() {
        let html = r#"var ytInitialData = {"contents":{"twoColumnSearchResultsRenderer":{"primaryContents":{"sectionListRenderer":{"contents":[{"itemSectionRenderer":{"contents":[{"adSlotRenderer":{}},{"videoRenderer":{"videoId":"abcdefghijk","title":{"simpleText":"Amazing Grace Official Video"}}}]}}]}}}}};</script>"#;
        assert_eq!(video_info(html).as_ref().map(|(id, _)| id.as_str()), Some("abcdefghijk"));
        assert_eq!(video_info(html).as_ref().map(|(_, title)| title.as_str()), Some("Amazing Grace Official Video"));
        assert_eq!(video_info("consent required"), None);
        assert_eq!(video_info(&html.replace("abcdefghijk", "https://bad")), None);
    }
    #[test]
    #[ignore = "Makes a live YouTube search without opening or playing audio"]
    fn live_search() {
        let result = search("Amazing Grace hymn").unwrap();
        println!("YouTube video resolved: {}", result.matched);
        assert!(result.matched, "YouTube returned no parseable video; search-page fallback will be used");
    }
}
