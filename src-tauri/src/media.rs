use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaState {
    source: String, title: String, artist: String, playing: bool,
    position: f64, duration: f64, rate: f64,
    can_toggle: bool, can_next: bool, can_previous: bool,
}

#[cfg(windows)]
mod platform {
    use super::*;
    use windows::{Media::Control::*, Win32::System::WinRT::*};
    struct Apartment;
    impl Apartment { fn new() -> windows::core::Result<Self> { unsafe { RoInitialize(RO_INIT_MULTITHREADED)?; } Ok(Self) } }
    impl Drop for Apartment { fn drop(&mut self) { unsafe { RoUninitialize(); } } }

    pub fn state() -> Result<Option<MediaState>, String> {
        let read = || -> windows::core::Result<Option<MediaState>> {
            let _apartment = Apartment::new()?;
            let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?.join()?;
            let session = match manager.GetCurrentSession() { Ok(value) => value, Err(_) => return Ok(None) };
            let metadata = session.TryGetMediaPropertiesAsync()?.join()?;
            let playback = session.GetPlaybackInfo()?;
            let controls = playback.Controls()?;
            let timeline = session.GetTimelineProperties()?;
            let playing = playback.PlaybackStatus()? == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
            let rate = playback.PlaybackRate().and_then(|value| value.Value()).unwrap_or(1.0);
            let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs_f64() + 11644473600.0;
            let updated = timeline.LastUpdatedTime()?.UniversalTime as f64 / 10_000_000.0;
            let duration = timeline.EndTime()?.Duration as f64 / 10_000_000.0;
            let mut position = timeline.Position()?.Duration as f64 / 10_000_000.0;
            if playing && updated > 0.0 { position += (now - updated).max(0.0) * rate; }
            if duration > 0.0 { position = position.min(duration); }
            Ok(Some(MediaState {
                source: session.SourceAppUserModelId()?.to_string(), title: metadata.Title()?.to_string(), artist: metadata.Artist()?.to_string(),
                playing, position: position.max(0.0), duration: duration.max(0.0), rate,
                can_toggle: controls.IsPlayPauseToggleEnabled()?, can_next: controls.IsNextEnabled()?, can_previous: controls.IsPreviousEnabled()?,
            }))
        };
        read().map_err(|e| format!("Could not read Windows media: {e}"))
    }

    pub fn control(action: &str, source: &str, title: &str) -> Result<(), String> {
        let _apartment = Apartment::new().map_err(|e| e.to_string())?;
        let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync().and_then(|op| op.join()).map_err(|e| e.to_string())?;
        let session = manager.GetCurrentSession().map_err(|_| "No active media player.")?;
        let current_title = session.TryGetMediaPropertiesAsync().and_then(|op| op.join()).and_then(|value| value.Title()).map_err(|e| e.to_string())?;
        if session.SourceAppUserModelId().map_err(|e| e.to_string())?.to_string() != source || current_title.to_string() != title {
            return Err("The active song changed. Try the control again.".into());
        }
        let controls = session.GetPlaybackInfo().and_then(|info| info.Controls()).map_err(|e| e.to_string())?;
        let supported = match action {
            "toggle" => controls.IsPlayPauseToggleEnabled(), "next" => controls.IsNextEnabled(), "previous" => controls.IsPreviousEnabled(),
            _ => return Err("Unknown media control.".into()),
        }.map_err(|e| e.to_string())?;
        if !supported { return Err("This player does not support that control.".into()); }
        let operation = match action { "toggle" => session.TryTogglePlayPauseAsync(), "next" => session.TrySkipNextAsync(), _ => session.TrySkipPreviousAsync() };
        if operation.and_then(|op| op.join()).map_err(|e| e.to_string())? { Ok(()) }
        else { Err("The player did not accept the command.".into()) }
    }

    pub fn play_spotify(query: &str) -> Result<bool, String> {
        let _apartment = Apartment::new().map_err(|e| e.to_string())?;
        let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
            .and_then(|op| op.join()).map_err(|e| e.to_string())?;
        let sessions = manager.GetSessions().map_err(|e| e.to_string())?;
        let query = normalize_title(query);
        for index in 0..sessions.Size().map_err(|e| e.to_string())? {
            let Ok(session) = sessions.GetAt(index) else { continue };
            let Ok(source) = session.SourceAppUserModelId() else { continue };
            let source = source.to_string().to_ascii_lowercase();
            if source != "spotify.exe" && !source.starts_with("spotifyab.spotifymusic_") {
                continue;
            }
            if !query.is_empty() {
                let Ok(properties) = session.TryGetMediaPropertiesAsync().and_then(|op| op.join()) else { continue };
                let Ok(title) = properties.Title() else { continue };
                let artist = properties.Artist().map(|value| value.to_string()).unwrap_or_default();
                let title = normalize_title(&title.to_string());
                if query != title && query != normalize_title(&format!("{title} by {artist}")) {
                    continue;
                }
            }
            let Ok(info) = session.GetPlaybackInfo() else { continue };
            if info.PlaybackStatus().ok() == Some(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
                || session.TryPlayAsync().and_then(|op| op.join()).unwrap_or(false) {
                return Ok(true);
            }
        }
        Ok(false)
    }

    pub fn play_youtube(title_hint: &str) -> Result<(), String> {
        let _apartment = Apartment::new().map_err(|e| e.to_string())?;
        let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
            .and_then(|op| op.join()).map_err(|e| e.to_string())?;
        let needle = normalize_title(title_hint);
        if needle.is_empty() { return Err("The YouTube title was empty.".into()); }
        for _ in 0..16 {
            if let Ok(sessions) = manager.GetSessions() {
                for index in 0..sessions.Size().unwrap_or(0) {
                    let Ok(session) = sessions.GetAt(index) else { continue };
                    let Ok(source) = session.SourceAppUserModelId() else { continue };
                    let source = source.to_string().to_ascii_lowercase();
                    if !["chrome", "msedge", "firefox", "brave", "opera", "vivaldi", "chromium"]
                        .iter().any(|browser| source.starts_with(browser)) {
                        continue;
                    }
                    let Ok(properties) = session.TryGetMediaPropertiesAsync().and_then(|op| op.join()) else { continue };
                    let Ok(title) = properties.Title() else { continue };
                    let current = normalize_title(&title.to_string());
                    if current != needle && current.strip_prefix(&needle).is_none_or(|suffix| !suffix.starts_with(' ')) { continue; }
                    let Ok(info) = session.GetPlaybackInfo() else { continue };
                    if info.PlaybackStatus().ok() == Some(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing) { return Ok(()); }
                    if info.Controls().and_then(|controls| controls.IsPlayEnabled()).unwrap_or(false)
                        && session.TryPlayAsync().and_then(|op| op.join()).unwrap_or(false) { return Ok(()); }
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
        Err("YouTube did not expose a playable media session.".into())
    }

    fn normalize_title(value: &str) -> String {
        value.chars().flat_map(char::to_lowercase).map(|character| if character.is_alphanumeric() { character } else { ' ' })
            .collect::<String>().split_whitespace().collect::<Vec<_>>().join(" ")
    }
}

#[tauri::command]
pub async fn media_state() -> Result<Option<MediaState>, String> {
    #[cfg(windows)]
    { tauri::async_runtime::spawn_blocking(platform::state).await.map_err(|e| e.to_string())? }
    #[cfg(not(windows))]
    { Err("System media controls require Windows.".into()) }
}

#[tauri::command]
pub async fn media_control(action: String, source: String, title: String) -> Result<(), String> {
    #[cfg(windows)]
    { tauri::async_runtime::spawn_blocking(move || platform::control(&action, &source, &title)).await.map_err(|e| e.to_string())? }
    #[cfg(not(windows))]
    { let _ = (action, source, title); Err("System media controls require Windows.".into()) }
}

#[tauri::command]
pub async fn media_play_spotify(query: String) -> Result<bool, String> {
    #[cfg(windows)]
    { tauri::async_runtime::spawn_blocking(move || platform::play_spotify(&query)).await.map_err(|e| e.to_string())? }
    #[cfg(not(windows))]
    { let _ = query; Ok(false) }
}

#[tauri::command]
pub async fn media_play_youtube(title: String) -> Result<(), String> {
    #[cfg(windows)]
    { tauri::async_runtime::spawn_blocking(move || platform::play_youtube(&title)).await.map_err(|e| e.to_string())? }
    #[cfg(not(windows))]
    { let _ = title; Err("YouTube playback control requires Windows.".into()) }
}

#[cfg(all(test, windows))]
mod tests {
    #[test]
    #[ignore = "Reads the current Windows media session without changing playback"]
    fn reads_live_session() { assert!(super::platform::state().is_ok()); }
}
