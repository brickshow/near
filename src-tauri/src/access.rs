//! Preview grants are never restored from disk: every process must contact D1.
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::sync::{
    Mutex,
    atomic::{AtomicBool, Ordering},
};
use std::time::{Duration, Instant, SystemTime};
use tauri::{Emitter, Manager};
use tauri_plugin_opener::OpenerExt;

const PERIOD: u64 = 72 * 60 * 60;
const LEASE: u64 = 30;
static REQUEST: Mutex<()> = Mutex::new(());
static SESSION: Mutex<Option<Session>> = Mutex::new(None);
static STARTED: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AccessState {
    PreviewNotActivated,
    PreviewActive,
    PreviewExpired,
    CommercialLicenseActive,
    CommercialLicenseInvalid,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub state: AccessState,
    pub activated_at: Option<u64>,
    pub expires_at: Option<u64>,
    pub server_now: u64,
    pub activations_enabled: bool,
    #[serde(default)]
    pub verified: bool,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub remaining_seconds: u64,
}
#[derive(Serialize, Deserialize)]
struct Identity {
    token: String,
    activated_at: Option<u64>,
    expires_at: Option<u64>,
    #[serde(default)]
    notified_24h: bool,
    #[serde(default)]
    notified_1h: bool,
}
struct Session {
    status: Status,
    checked: Instant,
    wall: SystemTime,
}

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new("com.app.near.preview.v1", "anonymous-access").map_err(|e| e.to_string())
}
fn identity() -> Result<Option<Identity>, String> {
    match entry()?.get_password() {
        Ok(value) => serde_json::from_str(&value).map(Some).map_err(|_| "Preview identity is damaged. Restore your OS credential store; no new preview was started.".into()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Unlock your OS credential store and retry. No new preview was started.".into()),
    }
}
fn save(value: &Identity) -> Result<(), String> {
    entry()?
        .set_password(&serde_json::to_string(value).map_err(|e| e.to_string())?)
        .map_err(|_| "Could not securely save preview identity. No access granted.".into())
}
fn initial() -> Status {
    Status {
        state: AccessState::PreviewNotActivated,
        activated_at: None,
        expires_at: None,
        server_now: 0,
        activations_enabled: true,
        verified: false,
        message: String::new(),
        remaining_seconds: 0,
    }
}
fn lease_valid(elapsed: Duration, wall_elapsed: Option<Duration>) -> bool {
    elapsed < Duration::from_secs(LEASE)
        && wall_elapsed.is_some_and(|wall| wall.abs_diff(elapsed) < Duration::from_secs(2))
}
pub fn status() -> Status {
    let guard = SESSION.lock().unwrap_or_else(|e| e.into_inner());
    let Some(session) = guard.as_ref() else {
        return initial();
    };
    snapshot(
        session,
        session.checked.elapsed(),
        SystemTime::now().duration_since(session.wall).ok(),
    )
}
fn snapshot(session: &Session, elapsed: Duration, wall_elapsed: Option<Duration>) -> Status {
    let mut result = session.status.clone();
    result.remaining_seconds = result
        .expires_at
        .unwrap_or(0)
        .saturating_sub(result.server_now.saturating_add(elapsed.as_secs()));
    if result.state == AccessState::PreviewActive {
        if result.remaining_seconds == 0 {
            result.state = AccessState::PreviewExpired;
        }
        result.verified &= lease_valid(elapsed, wall_elapsed);
        if !result.verified {
            result.message = "Connect to the internet to verify your existing preview. Your original dates are preserved.".into();
        }
    }
    result
}
pub fn require() -> Result<(), String> {
    let value = status();
    if value.verified
        && matches!(
            value.state,
            AccessState::PreviewActive | AccessState::CommercialLicenseActive
        )
    {
        Ok(())
    } else {
        Err("NEAR access is locked. Verify your preview or manage your personal data.".into())
    }
}
fn endpoint() -> Result<String, String> {
    let value = option_env!("NEAR_PREVIEW_API_URL")
        .ok_or("This build has no preview service configured.")?;
    let url = url::Url::parse(value).map_err(|_| "Invalid preview service URL")?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(
            "Preview service must use HTTPS without credentials, query, or fragment.".into(),
        );
    }
    Ok(value.trim_end_matches('/').into())
}
fn refresh(app: &tauri::AppHandle, activate: bool) -> Result<Status, String> {
    let _serial = REQUEST.lock().map_err(|e| e.to_string())?;
    let endpoint = endpoint()?;
    let mut id = match identity()? {
        Some(id) => id,
        None if !activate => return Ok(initial()),
        None => {
            let mut bytes = [0u8; 32];
            rand::thread_rng().fill_bytes(&mut bytes);
            let id = Identity {
                token: bytes.iter().map(|b| format!("{b:02x}")).collect(),
                activated_at: None,
                expires_at: None,
                notified_24h: false,
                notified_1h: false,
            };
            // Persist BEFORE HTTP. A lost response must retry the same activation.
            save(&id)?;
            id
        }
    };
    let checked = Instant::now();
    let wall = SystemTime::now();
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;
    let mut result: Status = client
        .post(format!(
            "{endpoint}/v1/{}",
            if activate { "activate" } else { "status" }
        ))
        .bearer_auth(&id.token)
        .send()
        .and_then(|r| r.error_for_status())
        .and_then(|r| r.json())
        .map_err(|_| {
            "Could not reach the preview service. Retry when connected; no new preview was started."
                .to_string()
        })?;
    match result.state {
        AccessState::PreviewActive | AccessState::PreviewExpired => {
            let start = result.activated_at.ok_or("Missing activation time")?;
            let end = result.expires_at.ok_or("Missing expiration time")?;
            if end.checked_sub(start) != Some(PERIOD)
                || start > result.server_now
                || (id.activated_at.is_some()
                    && (id.activated_at != Some(start) || id.expires_at != Some(end)))
            {
                return Err(
                    "Preview service returned inconsistent dates. Access remains locked.".into(),
                );
            }
            result.state = if result.server_now < end {
                AccessState::PreviewActive
            } else {
                AccessState::PreviewExpired
            };
            id.activated_at = Some(start);
            id.expires_at = Some(end);
            let remaining = end.saturating_sub(result.server_now);
            let notice = if remaining > 0 && remaining <= 3600 && !id.notified_1h {
                id.notified_1h = true;
                id.notified_24h = true;
                Some("About 1 hour remains in your Hackathon Preview.")
            } else if remaining > 3600 && remaining <= 86400 && !id.notified_24h {
                id.notified_24h = true;
                Some("About 24 hours remain in your Hackathon Preview.")
            } else {
                None
            };
            save(&id)?;
            if let Some(message) = notice {
                let _ = app.emit("near://access-notice", message);
            }
        }
        AccessState::PreviewNotActivated if id.activated_at.is_none() => {}
        _ => return Err("Unsupported access grant. Commercial licensing is coming soon.".into()),
    }
    result.verified = true;
    result.message.clear();
    *SESSION.lock().map_err(|e| e.to_string())? = Some(Session {
        status: result,
        checked,
        wall,
    });
    Ok(status())
}
#[tauri::command]
pub fn access_status() -> Status {
    status()
}
#[tauri::command]
pub async fn access_refresh(app: tauri::AppHandle, activate: bool) -> Result<Status, String> {
    STARTED.store(true, Ordering::Relaxed);
    tauri::async_runtime::spawn_blocking(move || refresh(&app, activate))
        .await
        .map_err(|e| e.to_string())?
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
            | "access_refresh"
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
        let mut last_refresh = Instant::now();
        let mut was_allowed = false;
        loop {
            std::thread::sleep(Duration::from_millis(250));
            let allowed = require().is_ok();
            if was_allowed && !allowed {
                crate::WHISPER_DOWNLOAD_CANCEL.store(true, Ordering::Relaxed);
                let _ = app.emit("near://access-locked", status());
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
            if STARTED.load(Ordering::Relaxed) && last_refresh.elapsed() >= Duration::from_secs(15)
            {
                last_refresh = Instant::now();
                let app = app.clone();
                std::thread::spawn(move || {
                    let _ = refresh(&app, false);
                });
            }
        }
    });
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lease_expires_and_rejects_clock_changes_and_suspend() {
        assert!(lease_valid(
            Duration::from_secs(10),
            Some(Duration::from_secs(10))
        ));
        assert!(!lease_valid(
            Duration::from_secs(30),
            Some(Duration::from_secs(30))
        ));
        assert!(!lease_valid(Duration::from_secs(1), None));
        assert!(!lease_valid(
            Duration::from_secs(1),
            Some(Duration::from_secs(7200))
        ));
    }
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
    fn expiry_is_exclusive_and_stale_grants_cannot_authorize_access() {
        let mut grant = initial();
        grant.state = AccessState::PreviewActive;
        grant.activated_at = Some(100);
        grant.expires_at = Some(259300);
        grant.server_now = 259299;
        grant.verified = true;
        let session = Session {
            status: grant,
            checked: Instant::now(),
            wall: SystemTime::now(),
        };
        let before = snapshot(&session, Duration::ZERO, Some(Duration::ZERO));
        assert_eq!(before.state, AccessState::PreviewActive);
        assert_eq!(before.remaining_seconds, 1);
        let end = snapshot(
            &session,
            Duration::from_secs(1),
            Some(Duration::from_secs(1)),
        );
        assert_eq!(end.state, AccessState::PreviewExpired);
        let stale = snapshot(
            &session,
            Duration::from_secs(30),
            Some(Duration::from_secs(30)),
        );
        assert!(!stale.verified);
        assert!(SESSION.lock().unwrap().is_none()); // a fresh process has no grant
        assert!(require().is_err());
    }

    #[test]
    #[ignore = "Requires an unlocked native OS credential store; run on each release platform"]
    fn preview_identity_survives_app_data_deletion() {
        let account = format!("reinstall-test-{}", uuid::Uuid::new_v4());
        let entry = keyring::Entry::new("com.app.near.preview.test", &account).unwrap();
        let id = Identity {
            token: "a".repeat(64),
            activated_at: Some(100),
            expires_at: Some(259300),
            notified_24h: false,
            notified_1h: false,
        };
        let serialized = serde_json::to_string(&id).unwrap();
        entry
            .set_password(&serialized)
            .expect("unlock native credential store");
        let app_data = std::env::temp_dir().join(&account);
        std::fs::create_dir_all(&app_data).unwrap();
        std::fs::write(app_data.join("near.db"), b"synthetic app data").unwrap();
        std::fs::remove_dir_all(app_data).unwrap();
        let persisted = entry.get_password().unwrap();
        entry.delete_credential().unwrap();
        let restored: Identity = serde_json::from_str(&persisted).unwrap();
        assert_eq!(restored.token, id.token);
        assert_eq!(restored.expires_at, id.expires_at);
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
