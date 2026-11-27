//! The preview uses the local wall clock and persists in the OS credential store.
use serde::{Deserialize, Serialize};
use std::sync::{Mutex, atomic::Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};
use tauri_plugin_opener::OpenerExt;

const PERIOD: u64 = 72 * 60 * 60;
static ACTIVATION: Mutex<()> = Mutex::new(());
static PREVIEW: Mutex<Option<Preview>> = Mutex::new(None);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    remaining_seconds: u64,
}

#[derive(Default, Serialize, Deserialize)]
struct Preview {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    token: Option<String>, // Preserve the legacy credential on updates.
    activated_at: Option<u64>,
    expires_at: Option<u64>,
    #[serde(default)]
    notified_24h: bool,
    #[serde(default)]
    notified_1h: bool,
}

impl Preview {
    fn remaining_seconds(&self, now: u64) -> u64 {
        self.expires_at.unwrap_or(0).saturating_sub(now)
    }

    fn start(&mut self, now: u64) -> Result<bool, String> {
        match (self.activated_at, self.expires_at) {
            (None, None) => {
                let end = now
                    .checked_add(PERIOD)
                    .ok_or("Invalid device date and time.")?;
                self.activated_at = Some(now);
                self.expires_at = Some(end);
                Ok(true)
            }
            (Some(start), Some(end)) if end.checked_sub(start) == Some(PERIOD) => Ok(false),
            _ => Err("Your preview has invalid activation dates.".into()),
        }
    }
}

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new("com.app.near.preview.v1", "anonymous-access").map_err(|e| e.to_string())
}

fn load(entry: &keyring::Entry) -> Result<Preview, String> {
    match entry.get_password() {
        Ok(value) => {
            serde_json::from_str(&value).map_err(|_| "Your saved preview could not be read.".into())
        }
        Err(keyring::Error::NoEntry) => Ok(Preview::default()),
        Err(_) => Err("Unlock your OS credential store and try again.".into()),
    }
}

fn save(entry: &keyring::Entry, preview: &Preview) -> Result<(), String> {
    entry
        .set_password(&serde_json::to_string(preview).map_err(|e| e.to_string())?)
        .map_err(|_| "Could not save your preview in the OS credential store.".into())
}

fn local_now() -> Result<u64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .map_err(|_| "Check your device's date and time and try again.".into())
}

#[tauri::command]
pub fn access_status() -> Result<Option<Status>, String> {
    let preview = PREVIEW.lock().map_err(|e| e.to_string())?;
    let now = local_now()?;
    Ok(preview.as_ref().map(|preview| Status {
        remaining_seconds: preview.remaining_seconds(now),
    }))
}

pub fn require() -> Result<(), String> {
    if access_status()?.is_some_and(|value| value.remaining_seconds > 0) {
        Ok(())
    } else {
        Err("NEAR access is locked. You can still manage your personal data.".into())
    }
}

fn activate() -> Result<Status, String> {
    let _serial = ACTIVATION.lock().map_err(|e| e.to_string())?;
    if let Some(status) = access_status()? {
        return Ok(status);
    }

    let entry = entry()?;
    let mut stored = load(&entry)?;
    let now = local_now()?;
    if stored.start(now)? {
        save(&entry, &stored)?;
    }
    let status = Status {
        remaining_seconds: stored.remaining_seconds(now),
    };
    *PREVIEW.lock().map_err(|e| e.to_string())? = Some(stored);
    Ok(status)
}

#[tauri::command]
pub async fn access_activate() -> Result<Status, String> {
    tauri::async_runtime::spawn_blocking(activate)
        .await
        .map_err(|e| e.to_string())?
}

fn preview_notice() -> Result<Option<&'static str>, String> {
    let guard = PREVIEW.lock().map_err(|e| e.to_string())?;
    let Some(preview) = guard.as_ref() else {
        return Ok(None);
    };
    let remaining = preview.remaining_seconds(local_now()?);
    let (message, notified_1h) = match remaining {
        1..=3600 if !preview.notified_1h => {
            ("About 1 hour remains in your Hackathon Preview.", true)
        }
        3601..=86400 if !preview.notified_24h => {
            ("About 24 hours remain in your Hackathon Preview.", false)
        }
        _ => return Ok(None),
    };
    let updated = Preview {
        token: preview.token.clone(),
        notified_24h: true,
        notified_1h: preview.notified_1h || notified_1h,
        ..*preview
    };
    drop(guard);
    save(&entry()?, &updated)?;
    *PREVIEW.lock().map_err(|e| e.to_string())? = Some(updated);
    Ok(Some(message))
}

#[tauri::command]
pub fn access_open_landing(app: tauri::AppHandle) -> Result<(), String> {
    let value = option_env!("NEAR_LANDING_URL").unwrap_or("https://near.brickshow.site/#get-near");
    let url = url::Url::parse(value).map_err(|e| e.to_string())?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Invalid official landing URL".into());
    }
    app.opener()
        .open_url(value, None::<&str>)
        .map_err(|e| e.to_string())
}
// Narrow allowlist: all primary custom commands are denied by default.
pub fn public_command(command: &str) -> bool {
    matches!(
        command,
        "access_status"
            | "access_activate"
            | "access_open_landing"
            | "access_export_data"
            | "access_delete_data"
            | "get_main_monitor"
            | "set_notch_bounds"
            | "set_notch_mouse_control"
            | "set_notch_auto_hide_seconds"
            | "exit_near"
            | "chatgpt_disconnect"
            | "cancel_whisper_model_download"
    )
}
pub fn start(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut was_allowed = false;
        let mut last_notice_check = Instant::now();
        loop {
            std::thread::sleep(Duration::from_millis(250));
            let allowed = require().is_ok();
            if was_allowed && !allowed {
                crate::WHISPER_DOWNLOAD_CANCEL.store(true, Ordering::Relaxed);
                let _ = app.emit("near://access-locked", ());
                // Terminate all feature webviews to cancel JS fetches, audio and microphone
                // capture, including outstanding getUserMedia and unmounted async work.
                for (label, window) in app.webview_windows() {
                    if label != "main" {
                        let _ = window.close();
                    } else {
                        let _ = window.eval("window.location.reload()");
                    }
                }
                std::thread::spawn(crate::voice_models::stop_preview_voice);
            }
            was_allowed = allowed;
            if allowed && last_notice_check.elapsed() >= Duration::from_secs(15) {
                last_notice_check = Instant::now();
                if let Ok(Some(message)) = preview_notice() {
                    let _ = app.emit("near://access-notice", message);
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn primary_commands_default_to_denied() {
        for name in [
            "chatgpt_reply",
            "transcribe_near_audio",
            "synthesize_near_voice",
            "db_select",
            "db_execute",
            "media_control",
            "new_future_feature",
        ] {
            assert!(!public_command(name));
        }
        assert!(public_command("access_export_data"));
        assert!(public_command("access_delete_data"));
    }
    #[test]
    fn preview_starts_once_and_expires_after_72_hours() {
        let mut preview: Preview =
            serde_json::from_str(r#"{"token":"legacy","activated_at":null,"expires_at":null}"#)
                .unwrap();
        assert_eq!(preview.start(100), Ok(true));
        assert_eq!(preview.remaining_seconds(100), PERIOD);

        let serialized = serde_json::to_string(&preview).unwrap();
        let mut restored: Preview = serde_json::from_str(&serialized).unwrap();
        assert_eq!(restored.start(100 + PERIOD - 1), Ok(false));
        assert_eq!(restored.remaining_seconds(100 + PERIOD - 1), 1);
        assert_eq!(restored.remaining_seconds(100 + PERIOD), 0);
        assert_eq!(restored.start(100 + PERIOD + 1), Ok(false));
        assert_eq!(restored.remaining_seconds(100 + PERIOD + 1), 0);
    }

    #[test]
    #[ignore = "Requires an unlocked native OS credential store"]
    fn preview_identity_survives_app_data_deletion() {
        let account = format!("reinstall-test-{}", uuid::Uuid::new_v4());
        let entry = keyring::Entry::new("com.app.near.preview.test", &account).unwrap();
        let mut preview = load(&entry).unwrap();
        preview.start(100).unwrap();
        save(&entry, &preview).expect("unlock native credential store");

        let app_data = std::env::temp_dir().join(&account);
        std::fs::create_dir_all(&app_data).unwrap();
        std::fs::write(app_data.join("near.db"), b"synthetic app data").unwrap();
        std::fs::remove_dir_all(app_data).unwrap();

        let restored = load(&entry);
        entry.delete_credential().unwrap();
        let restored = restored.unwrap();
        assert_eq!(restored.activated_at, preview.activated_at);
        assert_eq!(restored.expires_at, preview.expires_at);
    }
    #[test]
    fn capabilities_do_not_expose_unguarded_sql_queries() {
        let directory = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("capabilities");
        for entry in std::fs::read_dir(directory).unwrap() {
            let path = entry.unwrap().path();
            if path.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }
            let capability: serde_json::Value =
                serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
            for permission in capability["permissions"].as_array().unwrap() {
                let name = permission
                    .as_str()
                    .or_else(|| permission["identifier"].as_str())
                    .unwrap();
                assert!(
                    !name.starts_with("sql:") || name == "sql:allow-load",
                    "unguarded SQL permission in {}",
                    path.display()
                );
            }
        }
    }
}
