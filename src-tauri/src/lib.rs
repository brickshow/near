mod access;
mod access_data;
mod media;
mod music;
mod voice_models;
mod bible_resources;
mod transcription_engine;
mod chat_models;
use chat_models::{ModelChoices, ReplyMode};

use tauri_plugin_sql::{Migration, MigrationKind};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};
use tauri::webview::{PermissionKind, PermissionResponse};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use jsonwebtoken::{decode, decode_header, jwk::JwkSet, Algorithm, DecodingKey, Validation};
use rand::RngCore;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::sync::{Mutex, atomic::{AtomicBool, AtomicU64, Ordering}};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use std::sync::OnceLock;
use std::collections::HashSet;
use whisper_rs::WhisperState;
use url::Url;

const TOKEN_URL: &str = "https://auth.openai.com/api/accounts/oauth/token";
const RESOURCE: &str = "https://api.openai.com/v1";
const NEAR_COMPANION_INSTRUCTIONS: &str = "You are NEAR, a calm, caring Christian companion who speaks with the warmth of a brother in Christ and helps the user grow in faith and draw closer to God through prayer, Scripture, and faithful daily living. Make biblical truth the foundation of spiritual answers, not your own unsupported opinions. Listen carefully and acknowledge the user's feelings before offering guidance. When relevant, offer a specific Scripture passage with an accurate book, chapter, and verse, explain its context plainly, and connect it to the user's situation with one gentle, practical next step that can encourage trust in God, hope, love, perseverance, prayer, or service. Offer a short prayer when the user asks or clearly welcomes one. Be comforting without minimizing pain, blaming hardship on weak faith, promising outcomes God has not promised, or forcing positivity. Never use Scripture to shame, threaten, manipulate, or pressure the user. Never invent Bible verses or quotations; identify the translation when quoting, and paraphrase with a clear note if exact wording is uncertain. Distinguish what Scripture explicitly says from interpretation or application. If Scripture does not directly address a question, say so honestly rather than presenting a personal opinion as biblical teaching; acknowledge that Christians may interpret some passages differently. Keep replies concise and natural to hear aloud. Format answers as short, readable paragraphs. For steps, use numbered lines. Never output asterisk characters, markdown emphasis, markdown headings, or markdown bullet symbols. Avoid decorative symbols and stage directions. Ask at most one gentle follow-up question when useful. Respect the user's beliefs, boundaries, and choices. Do not claim to speak for God, know God's will, be clergy or a licensed professional, or have taken actions you have not taken. Be transparent that you are an AI when relevant. For serious health, safety, or emotional concerns, respond with care, be clear about your limits, and encourage appropriate help from trusted people or qualified professionals. If the user may be in immediate danger, prioritize immediate help from local emergency services and someone they trust. Do not invent facts or promises; admit uncertainty when needed.";
static TOKEN_LOCK: Mutex<()> = Mutex::new(());
static OAUTH_GENERATION: AtomicU64 = AtomicU64::new(0);
static REDEEMED_CODES: OnceLock<Mutex<HashSet<[u8; 32]>>> = OnceLock::new();
static WHISPER_STATE: OnceLock<Mutex<Option<WhisperState>>> = OnceLock::new();
static OAUTH_HTTP: OnceLock<Result<Client, String>> = OnceLock::new();
static CHAT_MODEL_CACHE: Mutex<Option<(String, ModelChoices)>> = Mutex::new(None);
static WHISPER_DOWNLOAD_CANCEL: AtomicBool = AtomicBool::new(false);
static NOTCH_IDLE_GENERATION: AtomicU64 = AtomicU64::new(0);
static NOTCH_AUTO_HIDDEN: AtomicBool = AtomicBool::new(false);
static NOTCH_MOUSE_CONTROL: AtomicBool = AtomicBool::new(true);
static NOTCH_AUTO_HIDE_SECONDS: AtomicU64 = AtomicU64::new(15);
static NOTCH_AUTO_HIDE_CONFIGURED: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NotchCursorMove { x: f64, y: f64 }

fn hide_webview_context_menu(_window: &tauri::WebviewWindow) {
    #[cfg(windows)]
    {
        let _ = _window.with_webview(|webview| unsafe {
            if let Ok(core) = webview.controller().CoreWebView2() {
                if let Ok(settings) = core.Settings() {
                    let _ = settings.SetAreDefaultContextMenusEnabled(false);
                }
            }
        });
    }
}
const WHISPER_MODEL_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin?download=true";
const WHISPER_MODEL_SHA256: &str = "818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7";
const WHISPER_MODEL_SIZE_ESTIMATE: u64 = 32_200_000;

fn whisper_model_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("models");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("ggml-tiny-q5_1.bin"))
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WhisperModelStatus { installed: bool, model_name: &'static str, size_bytes: u64 }

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WhisperDownloadProgress { downloaded_bytes: u64, total_bytes: u64 }

fn whisper_model_installed(path: &std::path::Path) -> bool {
    path.metadata().is_ok_and(|metadata| metadata.len() >= 30_000_000)
        && std::fs::read_to_string(path.with_extension("ready")).is_ok_and(|hash| hash == WHISPER_MODEL_SHA256)
}

#[tauri::command]
fn whisper_model_status(app: tauri::AppHandle) -> Result<WhisperModelStatus, String> {
    let path = whisper_model_path(&app)?;
    Ok(WhisperModelStatus {
        installed: whisper_model_installed(&path),
        model_name: "Whisper tiny multilingual (Q5_1)",
        size_bytes: WHISPER_MODEL_SIZE_ESTIMATE,
    })
}

fn prepare_whisper_state(path: &std::path::Path) -> Result<(), String> {
    let cache = WHISPER_STATE.get_or_init(|| Mutex::new(None));
    let mut cached = cache.lock().map_err(|e| e.to_string())?;
    if cached.is_none() {
        *cached = Some(transcription_engine::load_state(path)?);
    }
    Ok(())
}

#[tauri::command]
async fn download_whisper_model(app: tauri::AppHandle) -> Result<(), String> {
    let path = whisper_model_path(&app)?;
    if whisper_model_installed(&path) { return Ok(()); }
    WHISPER_DOWNLOAD_CANCEL.store(false, Ordering::Relaxed);
    let result = download_whisper_model_inner(app.clone(), path.clone()).await;
    if result.is_err() { let _ = std::fs::remove_file(path.with_extension("bin.part")); }
    result
}

async fn download_whisper_model_inner(app: tauri::AppHandle, path: std::path::PathBuf) -> Result<(), String> {
    let temporary = path.with_extension("bin.part");
    let mut response = reqwest::get(WHISPER_MODEL_URL).await.map_err(|e| format!("Model download failed: {e}"))?;
    if !response.status().is_success() { return Err(format!("Model download failed ({})", response.status())); }
    let total = response.content_length().unwrap_or(WHISPER_MODEL_SIZE_ESTIMATE);
    let mut file = std::fs::File::create(&temporary).map_err(|e| format!("Could not save the model download: {e}"))?;
    let mut digest = Sha256::new();
    let mut downloaded = 0u64;
    let mut last_event = Instant::now();
    while let Some(chunk) = response.chunk().await.map_err(|e| format!("Model download interrupted: {e}"))? {
        access::require()?;
        if WHISPER_DOWNLOAD_CANCEL.load(Ordering::Relaxed) {
            drop(file);
            let _ = std::fs::remove_file(&temporary);
            return Err("Model download canceled.".into());
        }
        downloaded += chunk.len() as u64;
        file.write_all(&chunk).map_err(|e| format!("Could not save the model download: {e}"))?;
        digest.update(&chunk);
        if last_event.elapsed() >= Duration::from_millis(120) {
            let _ = app.emit("near://whisper-download-progress", WhisperDownloadProgress { downloaded_bytes: downloaded, total_bytes: total });
            last_event = Instant::now();
        }
    }
    file.sync_all().map_err(|e| e.to_string())?;
    drop(file);
    if WHISPER_DOWNLOAD_CANCEL.load(Ordering::Relaxed) {
        let _ = std::fs::remove_file(&temporary);
        return Err("Model download canceled.".into());
    }
    if downloaded < 30_000_000 || format!("{:x}", digest.finalize()) != WHISPER_MODEL_SHA256 {
        return Err("The downloaded speech model failed its integrity check. Please retry.".into());
    }
    std::fs::rename(&temporary, &path).map_err(|e| format!("Could not install the model: {e}"))?;
    std::fs::write(path.with_extension("ready"), WHISPER_MODEL_SHA256).map_err(|e| e.to_string())?;
    let _ = app.emit("near://whisper-download-progress", WhisperDownloadProgress { downloaded_bytes: downloaded, total_bytes: total });
    Ok(())
}

#[tauri::command]
fn cancel_whisper_model_download() {
    WHISPER_DOWNLOAD_CANCEL.store(true, Ordering::Relaxed);
}

#[tauri::command]
async fn prepare_whisper_model(app: tauri::AppHandle) -> Result<(), String> {
    let path = whisper_model_path(&app)?;
    if !whisper_model_installed(&path) { return Err("Download the offline speech model first.".into()); }
    tauri::async_runtime::spawn_blocking(move || prepare_whisper_state(&path)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn transcribe_near_audio(app: tauri::AppHandle, audio_base64: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || transcribe_near_audio_blocking(app, audio_base64))
        .await.map_err(|error| error.to_string())?
}

fn transcribe_near_audio_blocking(app: tauri::AppHandle, audio_base64: String) -> Result<String, String> {
    use base64::Engine;
    let path = whisper_model_path(&app)?;
    if !whisper_model_installed(&path) { return Err("The offline speech model is not installed yet.".into()); }
    let wav = base64::engine::general_purpose::STANDARD.decode(audio_base64).map_err(|e| format!("Invalid microphone audio: {e}"))?;
    let mut reader = hound::WavReader::new(std::io::Cursor::new(wav)).map_err(|e| format!("Could not read microphone audio: {e}"))?;
    let spec = reader.spec();
    if spec.channels != 1 || spec.sample_rate != 16_000 { return Err("Microphone audio must be mono at 16 kHz.".into()); }
    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => reader.samples::<f32>().map(|s| s.map_err(|e| e.to_string())).collect::<Result<_, _>>()?,
        hound::SampleFormat::Int => {
            let bits = spec.bits_per_sample;
            let scale = (1u64 << (bits.saturating_sub(1) as u32)) as f32;
            reader.samples::<i32>().map(|s| s.map(|v| v as f32 / scale).map_err(|e| e.to_string())).collect::<Result<_, _>>()?
        }
    };
    if samples.is_empty() { return Err("No microphone audio was recorded.".into()); }
    prepare_whisper_state(&path)?;
    let cache = WHISPER_STATE.get_or_init(|| Mutex::new(None));
    let mut cached = cache.lock().map_err(|e| e.to_string())?;
    let state = cached.as_mut().ok_or("Speech model is unavailable")?;
    // Quiet chunks are normal during pauses; the UI reports an empty final transcript after stop.
    transcription_engine::transcribe(state, &samples)
}

#[derive(Clone, Serialize, Deserialize)]
struct ClientRegistration { client_id: Option<String>, host_id: String }

#[derive(Clone, Serialize, Deserialize)]
struct CredentialMetadata {
    client_id: String,
    subject: String,
    email: Option<String>,
    scopes: Vec<String>,
    expires_at: u64,
}

#[derive(Serialize, Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    id_token: Option<String>,
    expires_in: u64,
    scope: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct StoredCredentials {
    access_token: String,
    refresh_token: String,
    id_token: String,
    metadata: CredentialMetadata,
}

#[derive(Default, Serialize, Deserialize)]
struct CredentialVault {
    active_client_id: Option<String>,
    profiles: Vec<StoredCredentials>,
}

impl CredentialVault {
    fn upsert(&mut self, credentials: StoredCredentials) {
        let client_id = credentials.metadata.client_id.clone();
        if let Some(profile) = self.profiles.iter_mut().find(|profile| profile.metadata.client_id == client_id) {
            *profile = credentials;
        } else {
            self.profiles.push(credentials);
        }
        self.active_client_id = Some(client_id);
    }

    fn disconnect_active(&mut self) {
        self.profiles.retain(|profile| Some(&profile.metadata.client_id) != self.active_client_id.as_ref());
        self.active_client_id = None;
    }
}

fn decode_vault(raw: &[u8]) -> Result<CredentialVault, String> {
    if let Ok(vault) = serde_json::from_slice::<CredentialVault>(raw) { return Ok(vault); }
    let legacy: StoredCredentials = serde_json::from_slice(raw).map_err(|e| format!("Stored ChatGPT credentials could not be read: {e}"))?;
    Ok(CredentialVault { active_client_id: Some(legacy.metadata.client_id.clone()), profiles: vec![legacy] })
}

fn registration_for_authorization(registration: &ClientRegistration, credentials: Option<&StoredCredentials>) -> ClientRegistration {
    let mut registration = registration.clone();
    if let Some(credentials) = credentials {
        registration.client_id = Some(credentials.metadata.client_id.clone());
    }
    registration
}

fn build_authorization_request(
    registration: &ClientRegistration,
    credentials: Option<&StoredCredentials>,
    redirect_uri: &str,
    state: &str,
    nonce: &str,
    challenge: &str,
) -> Result<(ClientRegistration, Url), String> {
    let registration = registration_for_authorization(registration, credentials);
    let mut authorize = Url::parse("https://auth.openai.com/api/accounts/authorize").map_err(|e| e.to_string())?;
    {
        let mut query = authorize.query_pairs_mut();
        query.append_pair("client_id", registration.client_id.as_deref().unwrap_or("dynamic_agent_client"));
        query.append_pair("response_type", "code");
        query.append_pair("redirect_uri", redirect_uri);
        query.append_pair("scope", "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct");
        query.append_pair("resource", RESOURCE);
        query.append_pair("state", state);
        query.append_pair("nonce", nonce);
        query.append_pair("code_challenge_method", "S256");
        query.append_pair("code_challenge", challenge);
        query.append_pair("ext_agent_host_id", &registration.host_id);
        if registration.client_id.is_none() { query.append_pair("agent_name_hint", "NEAR"); }
        if let Some(credentials) = credentials { query.append_pair("id_token_hint", &credentials.id_token); }
    }
    Ok((registration, authorize))
}

#[cfg(test)]
mod oauth_authorization_tests {
    use super::*;

    #[test]
    fn token_exchange_error_reports_only_the_provider_code() {
        let body = serde_json::json!({
            "error": "invalid_grant",
            "error_description": "Sensitive provider detail must not be displayed",
        });
        let message = token_exchange_failure(
            "ChatGPT token exchange failed",
            reqwest::StatusCode::BAD_REQUEST,
            Some(&body),
            Some("req-123"),
        );

        assert_eq!(message, "ChatGPT token exchange failed (400 Bad Request; invalid_grant). Request ID: req-123.");
        assert!(!message.contains("Sensitive provider detail"));
    }

    #[test]
    fn returning_sign_in_uses_issued_client_id_from_saved_credentials() {
        let registration = ClientRegistration { client_id: None, host_id: "urn:uuid:test-host".into() };
        let credentials = StoredCredentials {
            access_token: "access".into(),
            refresh_token: "refresh".into(),
            id_token: "id".into(),
            metadata: CredentialMetadata {
                client_id: "oaiapp_issued-client".into(),
                subject: "subject".into(),
                email: None,
                scopes: vec![],
                expires_at: 0,
            },
        };

        let (registration, authorize) = build_authorization_request(
            &registration, Some(&credentials), "http://127.0.0.1:12345/auth/callback", "state", "nonce", "challenge",
        ).unwrap();
        let query: std::collections::HashMap<String, String> = authorize.query_pairs().map(|(key, value)| (key.into_owned(), value.into_owned())).collect();
        assert_eq!(registration.client_id.as_deref(), Some("oaiapp_issued-client"));
        assert_eq!(query.get("client_id").map(String::as_str), Some("oaiapp_issued-client"));
        assert_eq!(query.get("id_token_hint").map(String::as_str), Some("id"));
        assert!(!query.contains_key("agent_name_hint"), "returning sign-in must not use the initial-registration hint");
    }

    #[test]
    fn first_sign_in_uses_dynamic_registration_and_agent_name() {
        let registration = ClientRegistration { client_id: None, host_id: "urn:uuid:test-host".into() };
        let (_, authorize) = build_authorization_request(
            &registration, None, "http://127.0.0.1:12345/auth/callback", "state", "nonce", "challenge",
        ).unwrap();
        let query: std::collections::HashMap<String, String> = authorize.query_pairs().map(|(key, value)| (key.into_owned(), value.into_owned())).collect();
        assert_eq!(query.get("client_id").map(String::as_str), Some("dynamic_agent_client"));
        assert_eq!(query.get("agent_name_hint").map(String::as_str), Some("NEAR"));
        assert!(!query.contains_key("id_token_hint"));
    }

    #[test]
    fn distinct_account_profiles_keep_their_own_registration_and_tokens() {
        let profile = |client_id: &str, subject: &str| StoredCredentials {
            access_token: format!("access-{subject}"),
            refresh_token: format!("refresh-{subject}"),
            id_token: format!("id-{subject}"),
            metadata: CredentialMetadata { client_id: client_id.into(), subject: subject.into(), email: None,
                scopes: vec!["chatgpt.tokens.use.direct".into()], expires_at: 0 },
        };
        let mut vault = CredentialVault::default();
        vault.upsert(profile("workspace-a-client", "user-a"));
        vault.upsert(profile("workspace-b-client", "user-b"));
        assert_eq!(vault.profiles.len(), 2);
        assert_eq!(vault.active_client_id.as_deref(), Some("workspace-b-client"));
        assert_eq!(vault.profiles[0].refresh_token, "refresh-user-a");
        assert_eq!(vault.profiles[1].refresh_token, "refresh-user-b");
        vault.disconnect_active();
        assert_eq!(vault.profiles.len(), 1);
        assert_eq!(vault.profiles[0].metadata.client_id, "workspace-a-client");
    }

    #[test]
    fn callback_client_id_must_match_the_selected_registration() {
        let existing = ClientRegistration { client_id: Some("account-a-client".into()), host_id: "urn:uuid:host".into() };
        assert!(resolve_callback_client_id(&existing, Some("account-b-client")).is_err());
        assert_eq!(resolve_callback_client_id(&existing, None).unwrap(), "account-a-client");
        let first = ClientRegistration { client_id: None, host_id: existing.host_id };
        assert_eq!(resolve_callback_client_id(&first, Some("account-b-client")).unwrap(), "account-b-client");
        assert!(resolve_callback_client_id(&first, None).is_err());
    }

    #[test]
    fn fresh_attempt_keeps_redirect_resource_and_original_pkce_verifier() {
        let state = random_token();
        let nonce = random_token();
        let verifier = random_token();
        assert_ne!(state, nonce);
        assert_ne!(nonce, verifier);
        let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
        let registration = ClientRegistration { client_id: None, host_id: "urn:uuid:host".into() };
        let (_, authorize) = build_authorization_request(&registration, None, "http://127.0.0.1:45123/auth/callback", &state, &nonce, &challenge).unwrap();
        let query: std::collections::HashMap<String, String> = authorize.query_pairs().map(|(key, value)| (key.into_owned(), value.into_owned())).collect();
        let form: std::collections::HashMap<&str, &str> = token_exchange_form("issued-client", "one-time-code", &verifier, "http://127.0.0.1:45123/auth/callback").into_iter().collect();
        assert_eq!(query["redirect_uri"], form["redirect_uri"]);
        assert_eq!(query["resource"], form["resource"]);
        assert_eq!(query["code_challenge"], URL_SAFE_NO_PAD.encode(Sha256::digest(form["code_verifier"].as_bytes())));
        assert_eq!(query["state"], state);
        assert_eq!(query["nonce"], nonce);
    }

    #[test]
    fn expired_code_is_discarded_and_only_a_fresh_code_can_be_claimed() {
        let first = random_token();
        let second = random_token();
        assert!(claim_authorization_code(&first).is_ok());
        assert!(claim_authorization_code(&first).is_err());
        assert!(should_retry_invalid_grant(Some(&serde_json::json!({"error":"invalid_grant"})), 1));
        assert!(!should_retry_invalid_grant(Some(&serde_json::json!({"error":"invalid_grant"})), 0));
        assert!(claim_authorization_code(&second).is_ok());
    }

}

#[derive(Serialize)]
struct ChatGptStatus { connected: bool, email: Option<String>, plan_usage_enabled: bool, message: String }

#[derive(Clone, Serialize)]
struct ChatGptRetry { url: String, diagnostic: String }

#[derive(Deserialize)]
struct ChatTurn { role: String, content: String }

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChatGptDelta { request_id: String, delta: String }

#[derive(Deserialize)]
struct IdClaims { sub: String, email: Option<String>, nonce: String }

fn random_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn app_config_path(app: &tauri::AppHandle, file: &str) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(file))
}

fn load_registration(app: &tauri::AppHandle) -> Result<ClientRegistration, String> {
    let path = app_config_path(app, "chatgpt-registration.json")?;
    if path.exists() {
        let raw = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
        return serde_json::from_str(&raw).map_err(|e| e.to_string());
    }
    let registration = ClientRegistration { client_id: None, host_id: format!("urn:uuid:{}", uuid::Uuid::new_v4()) };
    std::fs::write(path, serde_json::to_vec(&registration).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(registration)
}

fn save_registration(app: &tauri::AppHandle, registration: &ClientRegistration) -> Result<(), String> {
    let path = app_config_path(app, "chatgpt-registration.json")?;
    std::fs::write(path, serde_json::to_vec(registration).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

#[cfg(windows)]
fn credential_file() -> Result<std::path::PathBuf, String> {
    let roaming = std::env::var_os("APPDATA").ok_or("Windows profile folder is unavailable")?;
    let dir = std::path::PathBuf::from(roaming).join("NEAR");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("chatgpt-session.dpapi"))
}

#[cfg(windows)]
fn protect_credentials(clear: &[u8]) -> Result<Vec<u8>, String> {
    use windows::Win32::Security::Cryptography::{CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB};
    let input = CRYPT_INTEGER_BLOB { cbData: clear.len().try_into().map_err(|_| "Credential data is too large")?, pbData: clear.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe { CryptProtectData(&input, windows::core::w!("NEAR ChatGPT credentials"), None, None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut output) }
        .map_err(|e| format!("Windows could not protect ChatGPT credentials: {e}"))?;
    let encrypted = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { windows::Win32::Foundation::LocalFree(Some(windows::Win32::Foundation::HLOCAL(output.pbData as *mut std::ffi::c_void))); }
    Ok(encrypted)
}

#[cfg(windows)]
fn unprotect_credentials(encrypted: &[u8]) -> Result<Vec<u8>, String> {
    use windows::Win32::Security::Cryptography::{CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB};
    let input = CRYPT_INTEGER_BLOB { cbData: encrypted.len().try_into().map_err(|_| "Credential data is too large")?, pbData: encrypted.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe { CryptUnprotectData(&input, None, None, None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut output) }
        .map_err(|e| format!("Windows could not unlock ChatGPT credentials: {e}"))?;
    let clear = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { windows::Win32::Foundation::LocalFree(Some(windows::Win32::Foundation::HLOCAL(output.pbData as *mut std::ffi::c_void))); }
    Ok(clear)
}

#[cfg(windows)]
fn load_vault() -> Result<Option<CredentialVault>, String> {
    let path = credential_file()?;
    if !path.exists() { return Ok(None); }
    let encrypted = std::fs::read(path).map_err(|e| e.to_string())?;
    let clear = unprotect_credentials(&encrypted)?;
    decode_vault(&clear).map(Some)
}

#[cfg(windows)]
fn save_vault(vault: &CredentialVault) -> Result<(), String> {
    let path = credential_file()?;
    let clear = serde_json::to_vec(vault).map_err(|e| e.to_string())?;
    let encrypted = protect_credentials(&clear)?;
    let temporary = path.with_extension(format!("{}.tmp", std::process::id()));
    std::fs::write(&temporary, encrypted).map_err(|e| e.to_string())?;
    std::fs::rename(&temporary, &path).map_err(|e| e.to_string())
}

#[cfg(windows)]
fn delete_vault() -> Result<(), String> {
    match std::fs::remove_file(credential_file()?) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not remove ChatGPT credentials: {error}")),
    }
}

#[cfg(target_os = "macos")]
fn load_vault() -> Result<Option<CredentialVault>, String> {
    let entry = keyring::Entry::new("com.app.near", "chatgpt-session").map_err(|e| e.to_string())?;
    let clear = match entry.get_password() {
        Ok(value) => value,
        Err(keyring::Error::NoEntry) => return Ok(None),
        Err(error) => return Err(format!("Could not read ChatGPT credentials from macOS Keychain: {error}")),
    };
    decode_vault(clear.as_bytes()).map(Some)
}

#[cfg(target_os = "macos")]
fn save_vault(vault: &CredentialVault) -> Result<(), String> {
    let entry = keyring::Entry::new("com.app.near", "chatgpt-session").map_err(|e| e.to_string())?;
    let clear = serde_json::to_string(vault).map_err(|e| e.to_string())?;
    entry.set_password(&clear).map_err(|e| format!("Could not save ChatGPT credentials to macOS Keychain: {e}"))
}

#[cfg(target_os = "macos")]
fn delete_vault() -> Result<(), String> {
    let entry = keyring::Entry::new("com.app.near", "chatgpt-session").map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Could not remove ChatGPT credentials from macOS Keychain: {error}")),
    }
}

#[cfg(target_os = "linux")]
fn load_vault() -> Result<Option<CredentialVault>, String> {
    let entry = keyring::Entry::new("com.app.near", "chatgpt-session")
        .map_err(|error| format!("Could not open the Linux Secret Service keyring: {error}"))?;
    let clear = match entry.get_password() {
        Ok(value) => value,
        Err(keyring::Error::NoEntry) => return Ok(None),
        Err(error) => return Err(format!("Could not read ChatGPT credentials from the Linux Secret Service keyring: {error}")),
    };
    decode_vault(clear.as_bytes()).map(Some)
}

#[cfg(target_os = "linux")]
fn save_vault(vault: &CredentialVault) -> Result<(), String> {
    let entry = keyring::Entry::new("com.app.near", "chatgpt-session")
        .map_err(|error| format!("Could not open the Linux Secret Service keyring: {error}"))?;
    let clear = serde_json::to_string(vault).map_err(|error| error.to_string())?;
    entry.set_password(&clear).map_err(|error| format!("Could not save ChatGPT credentials to the Linux Secret Service keyring: {error}"))
}

#[cfg(target_os = "linux")]
fn delete_vault() -> Result<(), String> {
    let entry = keyring::Entry::new("com.app.near", "chatgpt-session")
        .map_err(|error| format!("Could not open the Linux Secret Service keyring: {error}"))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Could not remove ChatGPT credentials from the Linux Secret Service keyring: {error}")),
    }
}

#[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
fn load_vault() -> Result<Option<CredentialVault>, String> {
    Err("Secure ChatGPT credential storage is unavailable on this platform.".into())
}

#[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
fn save_vault(_: &CredentialVault) -> Result<(), String> {
    Err("Secure ChatGPT credential storage is unavailable on this platform.".into())
}

#[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
fn delete_vault() -> Result<(), String> {
    Err("Secure ChatGPT credential storage is unavailable on this platform.".into())
}

fn load_credentials() -> Result<Option<StoredCredentials>, String> {
    let Some(vault) = load_vault()? else { return Ok(None); };
    let active_client_id = vault.active_client_id;
    Ok(vault.profiles.into_iter().find(|profile| Some(&profile.metadata.client_id) == active_client_id.as_ref()))
}

fn save_credentials(credentials: &StoredCredentials) -> Result<(), String> {
    let mut vault = load_vault()?.unwrap_or_default();
    vault.upsert(credentials.clone());
    save_vault(&vault)
}

fn delete_credentials() -> Result<(), String> {
    let Some(mut vault) = load_vault()? else { return Ok(()); };
    vault.disconnect_active();
    if vault.profiles.is_empty() { delete_vault() } else { save_vault(&vault) }
}

#[cfg(all(test, target_os = "linux"))]
mod linux_credential_storage_tests {
    use super::load_credentials;

    #[test]
    fn chatgpt_sign_in_is_not_blocked_by_the_unsupported_platform_guard() {
        let result = load_credentials();
        assert!(
            !matches!(&result, Err(error) if error.contains("currently supported on Windows and macOS")),
            "Linux ChatGPT credential flow still returns the unsupported-platform error"
        );
    }

    #[test]
    fn secret_service_can_round_trip_a_test_credential() {
        if std::env::var_os("NEAR_TEST_SECRET_SERVICE").is_none() {
            return;
        }
        let account = format!("credential-round-trip-{}", std::process::id());
        let entry = keyring::Entry::new("com.app.near.test", &account)
            .expect("open isolated Linux Secret Service test entry");
        entry.set_password("near-secret-service-round-trip")
            .expect("store synthetic test credential");
        let stored = entry.get_password().expect("read synthetic test credential");
        assert_eq!(stored, "near-secret-service-round-trip");
        entry.delete_credential().expect("remove synthetic test credential");
    }
}

fn store_credentials(tokens: &OAuthTokenResponse, metadata: &CredentialMetadata) -> Result<(), String> {
    let old = load_credentials()?.filter(|stored| stored.metadata.client_id == metadata.client_id);
    let refresh_token = tokens.refresh_token.clone().or_else(|| old.as_ref().map(|stored| stored.refresh_token.clone()))
        .ok_or("ChatGPT did not return a refresh token")?;
    let id_token = tokens.id_token.clone().or_else(|| old.as_ref().map(|stored| stored.id_token.clone()))
        .ok_or("ChatGPT did not return an ID token")?;
    save_credentials(&StoredCredentials { access_token: tokens.access_token.clone(), refresh_token, id_token, metadata: metadata.clone() })
}

fn oauth_http() -> Result<Client, String> {
    OAUTH_HTTP.get_or_init(|| Client::builder().timeout(Duration::from_secs(45)).build().map_err(|e| e.to_string())).clone()
}

fn token_exchange_failure(action: &str, status: reqwest::StatusCode, body: Option<&serde_json::Value>, request_id: Option<&str>) -> String {
    let code = body
        .and_then(|value| value.get("error"))
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.is_empty() && value.len() <= 64 && value.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-')));
    let request_id = request_id.or_else(|| body.and_then(|value| value.get("request_id")).and_then(serde_json::Value::as_str))
        .filter(|value| !value.is_empty() && value.len() <= 128 && value.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-')));
    let mut message = match code {
        Some(code) => format!("{action} ({status}; {code})."),
        None => format!("{action} ({status})."),
    };
    if let Some(request_id) = request_id { message.push_str(&format!(" Request ID: {request_id}.")); }
    message
}

fn refresh_credentials() -> Result<(CredentialMetadata, String), String> {
    let _guard = TOKEN_LOCK.lock().map_err(|e| e.to_string())?;
    let mut stored = load_credentials()?.ok_or("Connect ChatGPT first.")?;
    let mut metadata = stored.metadata.clone();
    if !metadata.scopes.iter().any(|scope| scope == "chatgpt.tokens.use.direct") {
        return Err("ChatGPT plan usage was not enabled for NEAR. Connect again and allow plan usage.".into());
    }
    let mut access_token = stored.access_token.clone();
    if metadata.expires_at > SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() + 90 {
        return Ok((metadata, access_token));
    }
    let refresh_token = stored.refresh_token.clone();
    let response = oauth_http()?.post(TOKEN_URL).form(&[
        ("grant_type", "refresh_token"),
        ("client_id", metadata.client_id.as_str()),
        ("refresh_token", refresh_token.as_str()),
        ("resource", RESOURCE),
    ]).send().map_err(|e| format!("Could not refresh ChatGPT sign-in: {e}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let request_id = response.headers().get("x-request-id").and_then(|value| value.to_str().ok()).map(str::to_string);
        let body = response.json::<serde_json::Value>().ok();
        return Err(token_exchange_failure("ChatGPT sign-in needs renewal", status, body.as_ref(), request_id.as_deref()));
    }
    let refreshed: OAuthTokenResponse = response.json().map_err(|e| format!("Invalid token refresh response: {e}"))?;
    access_token = refreshed.access_token.clone();
    metadata.expires_at = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() + refreshed.expires_in;
    if let Some(scopes) = &refreshed.scope { metadata.scopes = scopes.split_whitespace().map(str::to_string).collect(); }
    stored.access_token = refreshed.access_token.clone();
    if let Some(refresh_token) = &refreshed.refresh_token { stored.refresh_token = refresh_token.clone(); }
    if let Some(id_token) = &refreshed.id_token { stored.id_token = id_token.clone(); }
    stored.metadata = metadata.clone();
    save_credentials(&stored)?;
    Ok((metadata, access_token))
}

fn validate_id_token(id_token: &str, client_id: &str, nonce: &str) -> Result<IdClaims, String> {
    let discovery: serde_json::Value = oauth_http()?.get("https://auth.openai.com/.well-known/openid-configuration")
        .send().map_err(|e| e.to_string())?.error_for_status().map_err(|e| e.to_string())?.json().map_err(|e| e.to_string())?;
    let issuer = discovery["issuer"].as_str().ok_or("OpenID issuer missing")?;
    let jwks_uri = discovery["jwks_uri"].as_str().ok_or("OpenID signing keys missing")?;
    let jwks: JwkSet = oauth_http()?.get(jwks_uri).send().map_err(|e| e.to_string())?
        .error_for_status().map_err(|e| e.to_string())?.json().map_err(|e| e.to_string())?;
    let header = decode_header(id_token).map_err(|e| e.to_string())?;
    let kid = header.kid.ok_or("ID token has no signing key id")?;
    let jwk = jwks.find(&kid).ok_or("ID token signing key was not found")?;
    let key = DecodingKey::from_jwk(jwk).map_err(|e| e.to_string())?;
    if header.alg != Algorithm::RS256 { return Err("ChatGPT ID token used an unsupported signing algorithm.".into()); }
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&[issuer]);
    validation.set_audience(&[client_id]);
    let claims = decode::<IdClaims>(id_token, &key, &validation).map_err(|e| format!("Could not validate ChatGPT ID token: {e}"))?.claims;
    if claims.nonce != nonce { return Err("ChatGPT sign-in nonce did not match.".into()); }
    Ok(claims)
}

fn read_oauth_callback(listener: TcpListener, expected_state: &str) -> Result<(String, Option<String>), String> {
    let deadline = std::time::Instant::now() + Duration::from_secs(300);
    loop {
        if std::time::Instant::now() >= deadline { return Err("ChatGPT sign-in timed out. Please try again.".into()); }
        let (mut stream, _) = match listener.accept() {
            Ok(value) => value,
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => { std::thread::sleep(Duration::from_millis(100)); continue; }
            Err(error) => return Err(error.to_string()),
        };
        let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
        let mut reader = BufReader::new(stream.try_clone().map_err(|e| e.to_string())?);
        let mut request = String::new();
        reader.read_line(&mut request).map_err(|e| e.to_string())?;
        let path = request.split_whitespace().nth(1).ok_or("Invalid OAuth callback")?;
        let callback = Url::parse(&format!("http://127.0.0.1{path}")).map_err(|e| e.to_string())?;
        if callback.path() != "/auth/callback" { continue; }
        let query: std::collections::HashMap<String, String> = callback.query_pairs().map(|(k, v)| (k.into_owned(), v.into_owned())).collect();
        let body = "<!doctype html><html><head><meta charset='utf-8'><title>NEAR sign-in</title><style>body{font:16px Segoe UI,sans-serif;background:#08131d;color:#eef6fb;text-align:center;padding:48px}</style></head><body><p>NEAR received the sign-in response. Checking the connection…</p><script>window.close();setTimeout(()=>location.replace('about:blank'),250)</script></body></html>";
        let response = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
        let _ = stream.write_all(response.as_bytes());
        if query.get("state").map(String::as_str) != Some(expected_state) { return Err("ChatGPT sign-in state did not match.".into()); }
        if let Some(error) = query.get("error") {
            let code = error.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-').take(64).collect::<String>();
            let request_id = query.get("request_id").filter(|value| value.len() <= 128 && value.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-')));
            return Err(match request_id {
                Some(request_id) => format!("ChatGPT sign-in was not completed ({code}). Request ID: {request_id}."),
                None => format!("ChatGPT sign-in was not completed ({code})."),
            });
        }
        let code = query.get("code").cloned().ok_or("No authorization code was returned")?;
        return Ok((code, query.get("client_id").cloned()));
    }
}

fn resolve_callback_client_id(registration: &ClientRegistration, callback_client_id: Option<&str>) -> Result<String, String> {
    match (registration.client_id.as_deref(), callback_client_id) {
        (Some(expected), Some(returned)) if expected != returned => Err("ChatGPT callback client ID did not match this account registration. Start a new sign-in.".into()),
        (Some(expected), _) => Ok(expected.into()),
        (None, Some(issued)) if issued != "dynamic_agent_client" && !issued.is_empty() => Ok(issued.into()),
        (None, _) => Err("ChatGPT did not return an issued client ID for this new account.".into()),
    }
}

fn token_exchange_form<'a>(client_id: &'a str, code: &'a str, verifier: &'a str, redirect_uri: &'a str) -> [(&'static str, &'a str); 6] {
    [("grant_type", "authorization_code"), ("client_id", client_id), ("code", code),
        ("code_verifier", verifier), ("redirect_uri", redirect_uri), ("resource", RESOURCE)]
}

fn should_retry_invalid_grant(body: Option<&serde_json::Value>, retry_remaining: u8) -> bool {
    retry_remaining > 0 && body.and_then(|value| value.get("error")).and_then(serde_json::Value::as_str) == Some("invalid_grant")
}

fn claim_authorization_code(code: &str) -> Result<(), String> {
    let code_hash: [u8; 32] = Sha256::digest(code.as_bytes()).into();
    if !REDEEMED_CODES.get_or_init(|| Mutex::new(HashSet::new())).lock().map_err(|e| e.to_string())?.insert(code_hash) {
        return Err("ChatGPT returned an authorization code that was already exchanged. Start a fresh sign-in.".into());
    }
    Ok(())
}

fn complete_oauth(app: tauri::AppHandle, listener: TcpListener, redirect_uri: String, registration: ClientRegistration, state: String, nonce: String, verifier: String, old_subject: Option<String>, generation: u64, retry_remaining: u8) -> Result<(), String> {
    let (code, callback_client_id) = read_oauth_callback(listener, &state)?;
    if OAUTH_GENERATION.load(Ordering::SeqCst) != generation { return Ok(()); }
    let client_id = resolve_callback_client_id(&registration, callback_client_id.as_deref())?;
    claim_authorization_code(&code)?;
    let response = oauth_http()?.post(TOKEN_URL).form(&token_exchange_form(&client_id, &code, &verifier, &redirect_uri))
        .send().map_err(|e| format!("Could not complete ChatGPT sign-in: {e}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let request_id = response.headers().get("x-request-id").and_then(|value| value.to_str().ok()).map(str::to_string);
        let body = response.json::<serde_json::Value>().ok();
        let invalid_grant = should_retry_invalid_grant(body.as_ref(), retry_remaining);
        let diagnostic = token_exchange_failure("ChatGPT token exchange failed", status, body.as_ref(), request_id.as_deref());
        if OAUTH_GENERATION.load(Ordering::SeqCst) != generation { return Ok(()); }
        if invalid_grant {
            let retry_registration = ClientRegistration { client_id: Some(client_id), host_id: registration.host_id };
            let url = start_oauth_attempt(app.clone(), retry_registration, None, old_subject, retry_remaining - 1)?;
            app.emit("near://chatgpt-auth-retry", ChatGptRetry { url, diagnostic }).map_err(|e| e.to_string())?;
            return Ok(());
        }
        return Err(diagnostic);
    }
    if OAUTH_GENERATION.load(Ordering::SeqCst) != generation { return Ok(()); }
    let tokens: OAuthTokenResponse = response.json().map_err(|e| format!("Invalid ChatGPT token response: {e}"))?;
    let claims = validate_id_token(tokens.id_token.as_deref().ok_or("ChatGPT did not return an ID token")?, &client_id, &nonce)?;
    if old_subject.as_ref().is_some_and(|subject| subject != &claims.sub) { return Err("You signed into a different ChatGPT account. Sign out of the current NEAR account first.".into()); }
    let scopes = tokens.scope.as_deref().unwrap_or("").split_whitespace().map(str::to_string).collect::<Vec<_>>();
    let metadata = CredentialMetadata {
        client_id: client_id.clone(), subject: claims.sub, email: claims.email, scopes,
        expires_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() + tokens.expires_in,
    };
    let _guard = TOKEN_LOCK.lock().map_err(|error| error.to_string())?;
    if OAUTH_GENERATION.load(Ordering::SeqCst) != generation { return Ok(()); }
    store_credentials(&tokens, &metadata)?;
    save_registration(&app, &ClientRegistration { client_id: Some(client_id), host_id: registration.host_id })?;
    let _ = app.emit("near://chatgpt-auth-complete", ());
    Ok(())
}

fn start_oauth_attempt(app: tauri::AppHandle, registration: ClientRegistration, credentials: Option<StoredCredentials>, old_subject: Option<String>, retry_remaining: u8) -> Result<String, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("Could not start local sign-in callback: {e}"))?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}/auth/callback");
    let state = random_token();
    let nonce = random_token();
    let verifier = random_token();
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let (registration, authorize) = build_authorization_request(
        &registration, credentials.as_ref(), &redirect_uri, &state, &nonce, &challenge,
    )?;
    let generation = {
        let _guard = TOKEN_LOCK.lock().map_err(|error| error.to_string())?;
        OAUTH_GENERATION.fetch_add(1, Ordering::SeqCst) + 1
    };
    let app_handle = app.clone();
    std::thread::spawn(move || {
        if let Err(error) = complete_oauth(app_handle.clone(), listener, redirect_uri, registration, state, nonce, verifier, old_subject, generation, retry_remaining) {
            if OAUTH_GENERATION.load(Ordering::SeqCst) != generation { return; }
            let _ = app_handle.emit("near://chatgpt-auth-error", error);
        }
    });
    Ok(authorize.to_string())
}

#[tauri::command]
fn chatgpt_begin_login(app: tauri::AppHandle, new_account: bool) -> Result<String, String> {
    let mut registration = load_registration(&app)?;
    let credentials = if new_account { None } else { load_credentials()? };
    if new_account || credentials.is_none() { registration.client_id = None; }
    let old_subject = credentials.as_ref().map(|stored| stored.metadata.subject.clone());
    start_oauth_attempt(app, registration, credentials, old_subject, 1)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ChatGptProfile { client_id: String, email: Option<String>, active: bool }

#[tauri::command]
fn chatgpt_profiles() -> Result<Vec<ChatGptProfile>, String> {
    let vault = load_vault()?.unwrap_or_default();
    Ok(vault.profiles.iter().map(|profile| ChatGptProfile {
        client_id: profile.metadata.client_id.clone(),
        email: profile.metadata.email.clone(),
        active: vault.active_client_id.as_ref() == Some(&profile.metadata.client_id),
    }).collect())
}

#[tauri::command]
fn chatgpt_select_profile(client_id: String) -> Result<(), String> {
    let _guard = TOKEN_LOCK.lock().map_err(|error| error.to_string())?;
    let mut vault = load_vault()?.ok_or("No ChatGPT accounts are saved.")?;
    if !vault.profiles.iter().any(|profile| profile.metadata.client_id == client_id) {
        return Err("That ChatGPT account is not saved on this device.".into());
    }
    vault.active_client_id = Some(client_id);
    save_vault(&vault)?;
    *CHAT_MODEL_CACHE.lock().map_err(|error| error.to_string())? = None;
    Ok(())
}

#[tauri::command]
async fn chatgpt_status() -> ChatGptStatus {
    match tauri::async_runtime::spawn_blocking(|| load_credentials().map(|value| value.map(|credentials| credentials.metadata))).await {
        Ok(Ok(Some(metadata))) => {
            let enabled = metadata.scopes.iter().any(|scope| scope == "chatgpt.tokens.use.direct");
            ChatGptStatus { connected: true, email: metadata.email, plan_usage_enabled: enabled, message: if enabled { "ChatGPT connected" } else { "ChatGPT account connected, but NEAR AI requires ChatGPT Go, Plus, Pro, or Business plan usage." }.into() }
        },
        Ok(Ok(None)) => ChatGptStatus { connected: false, email: None, plan_usage_enabled: false, message: "No AI account connected. Local features are ready; connect your own ChatGPT account to use AI assistance.".into() },
        Ok(Err(error)) => ChatGptStatus { connected: false, email: None, plan_usage_enabled: false, message: error },
        Err(error) => ChatGptStatus { connected: false, email: None, plan_usage_enabled: false, message: error.to_string() },
    }
}

#[tauri::command]
async fn chatgpt_disconnect(app: tauri::AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = TOKEN_LOCK.lock().map_err(|error| error.to_string())?;
        // OpenAI binds an issued client ID to the account and workspace that
        // registered it. A new account must go through dynamic registration.
        let mut registration = load_registration(&app)?;
        registration.client_id = None;
        save_registration(&app, &registration)?;
        delete_credentials()?;
        *CHAT_MODEL_CACHE.lock().map_err(|error| error.to_string())? = None;
        Ok::<(), String>(())
    }).await.map_err(|error| error.to_string())?
}

#[tauri::command]
async fn prepare_chatgpt() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        let (metadata, token) = refresh_credentials()?;
        cached_chat_models(&metadata.client_id, &token).map(|_| ())
    }).await.map_err(|e| e.to_string())?
}

fn cached_chat_models(subject: &str, token: &str) -> Result<ModelChoices, String> {
    // Share the in-flight lookup with the first reply as well as later turns.
    let mut cached = CHAT_MODEL_CACHE.lock().map_err(|e| e.to_string())?;
    if let Some((owner, models)) = cached.as_ref() {
        if owner == subject { return Ok(models.clone()); }
    }
    let response = oauth_http()?.get(format!("{RESOURCE}/models")).bearer_auth(token)
        .send().map_err(|e| e.to_string())?;
    if !response.status().is_success() { return Err(format!("Could not load ChatGPT models ({}).", response.status())); }
    let catalog: serde_json::Value = response.json().map_err(|e| e.to_string())?;
    let choices = ModelChoices::from_catalog(&catalog)?;
    *cached = Some((subject.into(), choices.clone()));
    Ok(choices)
}

// Dropping a reqwest async future/response cancels the local request, including
// a silent stream waiting for its next byte. No new provider work starts locked.
async fn with_access<F: std::future::Future>(future: F) -> Result<F::Output, String> {
    access::require()?;
    tokio::pin!(future);
    let mut interval = tokio::time::interval(Duration::from_millis(100));
    loop {
        tokio::select! {
            result = &mut future => { access::require()?; return Ok(result); },
            _ = interval.tick() => { access::require()?; }
        }
    }
}
#[tauri::command]
async fn chatgpt_reply(app: tauri::AppHandle, history: Vec<ChatTurn>, request_id: String, mode: Option<ReplyMode>) -> Result<String, String> {
    if history.is_empty() { return Err("Write a message first.".into()); }
    reply_from_chatgpt_async(history, mode.unwrap_or_default(), |delta| {
        let _ = app.emit("near://chatgpt-delta", ChatGptDelta { request_id: request_id.clone(), delta: delta.to_string() });
    }).await
}
async fn reply_from_chatgpt_async(history: Vec<ChatTurn>, mode: ReplyMode, mut on_delta: impl FnMut(&str)) -> Result<String, String> {
    access::require()?;
    let (access_token, model) = tauri::async_runtime::spawn_blocking(move || {
        access::require()?;
        let (metadata, token) = refresh_credentials()?;
        let model = cached_chat_models(&metadata.client_id, &token)?.for_mode(mode);
        Ok::<_, String>((token, model))
    }).await.map_err(|e| e.to_string())??;
    let client = reqwest::Client::builder().timeout(Duration::from_secs(45)).build().map_err(|e| e.to_string())?;
    let input: Vec<_> = history.iter().filter(|turn| turn.role == "user" || turn.role == "assistant")
        .map(|turn| serde_json::json!({"role":turn.role,"content":turn.content})).collect();
    let instructions = format!("{NEAR_COMPANION_INSTRUCTIONS}\nRespond directly to the user's latest message. Acknowledge feelings only when the user expresses them. Do not substitute generic reassurance such as 'I'm here with you' for answering a question or addressing a request. Do not repeat greetings or introductions on each turn. NEAR handles playback commands separately. Answer the current topic directly even if an earlier turn mentioned music. If a playback request reaches you, explain that the user can say Play music or Play followed by a song title. Never claim you started playback.");
    let mut payload = serde_json::json!({"model":model.slug,"instructions":instructions,"input":input,"store":false,"stream":true});
    if let Some(effort) = model.reasoning_effort { payload["reasoning"] = serde_json::json!({"effort":effort}); }
    let mut response = with_access(client.post(format!("{RESOURCE}/responses")).bearer_auth(&access_token).json(&payload).send())
        .await?.map_err(|e| format!("Could not reach ChatGPT: {e}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let detail = with_access(response.text()).await?.unwrap_or_default();
        return Err(format!("ChatGPT request failed ({status}): {detail}"));
    }
    let mut pending = Vec::new();
    let mut text = String::new();
    let mut completed = false;
    'stream: while let Some(chunk) = with_access(response.chunk()).await?.map_err(|e| format!("Could not read ChatGPT response: {e}"))? {
        pending.extend_from_slice(&chunk);
        if pending.len() > 2_000_000 { return Err("ChatGPT stream event exceeded the size limit.".into()); }
        while let Some(end) = pending.iter().position(|b| *b == b'\n') {
            let raw: Vec<u8> = pending.drain(..=end).collect();
            let line = std::str::from_utf8(&raw).map_err(|e| e.to_string())?;
            let Some(data) = line.trim_end().strip_prefix("data: ") else { continue; };
            if data == "[DONE]" { continue; }
            let event: serde_json::Value = serde_json::from_str(data).map_err(|e| format!("Invalid ChatGPT stream event: {e}"))?;
            match event["type"].as_str().unwrap_or("") {
                "response.output_text.delta" => if let Some(delta) = event["delta"].as_str() {
                    text.push_str(delta);
                    on_delta(delta);
                },
                "response.completed" => { completed = true; break 'stream; },
                "response.failed" => return Err(format!("ChatGPT could not answer: {}", event["response"]["error"]["message"].as_str().unwrap_or("request failed"))),
                "response.incomplete" => return Err("ChatGPT response was incomplete.".into()),
                _ => {}
            }
        }
    }
    if !completed { return Err("ChatGPT stream ended before the response completed.".into()); }
    if text.is_empty() { Err("ChatGPT returned no text.".into()) } else { Ok(text) }
}
#[cfg(test)]
fn reply_from_chatgpt(history: Vec<ChatTurn>, mode: ReplyMode, on_delta: impl FnMut(&str)) -> Result<String, String> {
    tauri::async_runtime::block_on(reply_from_chatgpt_async(history, mode, on_delta))
}

#[cfg(test)]
mod response_benchmark {
    use super::*;

    #[test]
    #[ignore = "Uses the existing ChatGPT sign-in and sends two short synthetic prompts"]
    fn response_latency() {
        let mut slow = false;
        let preparation = Instant::now();
        let (metadata, token) = refresh_credentials().expect("Sign-in unavailable");
        cached_chat_models(&metadata.client_id, &token).expect("Catalog unavailable");
        eprintln!("response preparation_ms={}", preparation.elapsed().as_millis());
        for label in ["first_after_prepare", "next_turn"] {
            let start = Instant::now();
            let mut first = None;
            let result = reply_from_chatgpt(vec![ChatTurn {
                role: "user".into(), content: "Say hello in one short sentence.".into(),
            }], ReplyMode::Voice, |delta| {
                if !delta.is_empty() && first.is_none() {
                    first = Some(start.elapsed().as_millis());
                    eprintln!("response {label}: first_text_ms={}", first.unwrap());
                }
            });
            if let Err(error) = result {
                // Do not print response bodies, credentials, or account metadata.
                panic!("Response benchmark failed: {}", error.split(": ").next().unwrap_or("request failed"));
            }
            eprintln!("response {label}: complete_ms={}", start.elapsed().as_millis());
            slow |= first.expect("No response text") > 3_000;
        }
        assert!(!slow, "First response text exceeded the 3-second target");
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_main_monitor(app: tauri::AppHandle) -> Result<Option<tauri::Monitor>, String> {
    let window = app.get_webview_window("main").ok_or("Main window is unavailable")?;
    window.current_monitor().map_err(|error| error.to_string())
}

// Move and resize in one Windows operation so a resize never paints at the
// previous frame's horizontal position. Coordinates are physical, including DPI.
#[tauri::command]
fn set_notch_bounds(window: tauri::WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    if !width.is_finite() || !height.is_finite() {
        return Err("Invalid notch dimensions".into());
    }
    let monitor = window.current_monitor().map_err(|e| e.to_string())?
        .ok_or("No monitor available")?;
    let scale = monitor.scale_factor();
    let max_width = (monitor.size().width as i32 - (48.0 * scale).round() as i32).max((320.0 * scale) as i32);
    let max_height = (monitor.size().height as i32 - (40.0 * scale).round() as i32).max((36.0 * scale) as i32);
    let width = ((width.clamp(320.0, 680.0) * scale).round() as i32).min(max_width);
    let height = ((height.clamp(36.0, 180.0) * scale).round() as i32).min(max_height);
    let x = monitor.position().x + (monitor.size().width as i32 - width) / 2;
    let y = monitor.position().y;

    #[cfg(windows)]
    {
        use windows::Win32::UI::WindowsAndMessaging::{SetWindowPos, SWP_NOACTIVATE, SWP_NOZORDER};
        let hwnd = window.hwnd().map_err(|e| e.to_string())?;
        // This command runs on the event thread; the HWND belongs to this live window.
        unsafe { SetWindowPos(hwnd, None, x, y, width, height, SWP_NOACTIVATE | SWP_NOZORDER) }
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        window.set_size(tauri::PhysicalSize::new(width as u32, height as u32)).map_err(|e| e.to_string())?;
        window.set_position(tauri::PhysicalPosition::new(x, y)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_start_at_login(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().map_err(|error| error.to_string())
}

#[tauri::command]
fn set_start_at_login(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let autolaunch = app.autolaunch();
    if enabled { autolaunch.enable() } else { autolaunch.disable() }
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn exit_near(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn set_notch_mouse_control(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    NOTCH_MOUSE_CONTROL.store(enabled, Ordering::SeqCst);
    app.emit("near://notch-mouse-control-changed", enabled).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_notch_auto_hide_seconds(seconds: u64) -> Result<(), String> {
    if ![0, 5, 10, 15, 30, 60].contains(&seconds) {
        return Err("Choose Never or an auto-hide time between 5 and 60 seconds.".into());
    }
    NOTCH_AUTO_HIDE_SECONDS.store(seconds, Ordering::SeqCst);
    NOTCH_AUTO_HIDE_CONFIGURED.store(true, Ordering::SeqCst);
    Ok(())
}

#[cfg(windows)]
fn desktop_cursor_position(_: &tauri::WebviewWindow) -> Result<(f64, f64), String> {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

    let mut point = POINT::default();
    unsafe { GetCursorPos(&mut point) }.map_err(|error| error.to_string())?;
    Ok((point.x as f64, point.y as f64))
}

#[cfg(not(windows))]
fn desktop_cursor_position(window: &tauri::WebviewWindow) -> Result<(f64, f64), String> {
    window.cursor_position().map(|position| (position.x, position.y)).map_err(|error| error.to_string())
}

fn restart_notch_idle_watch(window: tauri::WebviewWindow) {
    let generation = NOTCH_IDLE_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    NOTCH_AUTO_HIDDEN.store(false, Ordering::SeqCst);
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_always_on_top(true);

    std::thread::spawn(move || {
        let Ok(mut last_cursor) = desktop_cursor_position(&window) else { return };
        let mut last_movement = Instant::now();
        let mut previous_hide_seconds = NOTCH_AUTO_HIDE_SECONDS.load(Ordering::SeqCst);
        let mut previous_hide_configured = NOTCH_AUTO_HIDE_CONFIGURED.load(Ordering::SeqCst);

        while NOTCH_IDLE_GENERATION.load(Ordering::SeqCst) == generation {
            std::thread::sleep(Duration::from_millis(100));
            if NOTCH_IDLE_GENERATION.load(Ordering::SeqCst) != generation { break; }
            let Ok(cursor) = desktop_cursor_position(&window) else { continue };
            let hide_seconds = NOTCH_AUTO_HIDE_SECONDS.load(Ordering::SeqCst);
            let hide_configured = NOTCH_AUTO_HIDE_CONFIGURED.load(Ordering::SeqCst);
            if hide_seconds != previous_hide_seconds || hide_configured != previous_hide_configured {
                previous_hide_seconds = hide_seconds;
                previous_hide_configured = hide_configured;
                last_movement = Instant::now();
                if hide_seconds == 0 && NOTCH_AUTO_HIDDEN.swap(false, Ordering::SeqCst) {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_always_on_top(true);
                }
            }
            let moved = (cursor.0 - last_cursor.0).abs() >= 1.0
                || (cursor.1 - last_cursor.1).abs() >= 1.0;

            if moved {
                last_cursor = cursor;
                last_movement = Instant::now();
                if NOTCH_MOUSE_CONTROL.load(Ordering::SeqCst) {
                    let _ = window.emit("near://notch-cursor-move", NotchCursorMove { x: cursor.0, y: cursor.1 });
                    if NOTCH_AUTO_HIDDEN.swap(false, Ordering::SeqCst) {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_always_on_top(true);
                    }
                }
            } else if hide_configured
                && hide_seconds > 0
                && !NOTCH_AUTO_HIDDEN.load(Ordering::SeqCst)
                && last_movement.elapsed() >= Duration::from_secs(hide_seconds)
            {
                if window.hide().is_ok() {
                    NOTCH_AUTO_HIDDEN.store(true, Ordering::SeqCst);
                }
            }

            if !NOTCH_AUTO_HIDDEN.load(Ordering::SeqCst) {
                if window.is_minimized().unwrap_or(false) { let _ = window.unminimize(); }
                if !window.is_visible().unwrap_or(false) { let _ = window.show(); }
                if !window.is_always_on_top().unwrap_or(false) { let _ = window.set_always_on_top(true); }
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_near_tables",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_local_conversations",
            sql: include_str!("../migrations/0002_chat_conversations.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "calendar_event_reminders",
            sql: include_str!("../migrations/0003_calendar.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "repeat_upcoming_event_reminders",
            sql: include_str!("../migrations/0004_reminder_repeat.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "scripture_reflection_and_faith_journey",
            sql: include_str!("../migrations/0005_faith_journey.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::Builder::new().app_name("NEAR").build())
        .on_permission_request(|webview, permission| match permission {
            PermissionKind::Microphone if access::require().is_ok() && matches!(webview.label(), "main" | "near-notes") => PermissionResponse::Allow,
            _ => PermissionResponse::Default,
        })
        .setup(|app| {
            access::start(app.handle().clone());
            let global_shortcut = tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed
                        && shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::Space)
                    {
                        if let Some(window) = app.get_webview_window("main") {
                            restart_notch_idle_watch(window);
                        }
                        let _ = app.emit("near://toggle-notch", ());
                    }
                });
            // Global-hotkey cannot register shortcuts on native Wayland
            // sessions. Keep the plugin available, but let the tray icon be
            // the restore path instead of failing application setup.
            let uses_x11_backend = std::env::var("GDK_BACKEND")
                .is_ok_and(|backend| backend.split(',').next() == Some("x11"));
            let global_shortcut = if std::env::var_os("WAYLAND_DISPLAY").is_some() && !uses_x11_backend {
                global_shortcut
            } else {
                global_shortcut.with_shortcuts(["ctrl+shift+space"])?
            };
            app.handle().plugin(global_shortcut.build())?;
            let tray_icon = tauri::image::Image::new_owned(
                include_bytes!("../icons/128x128.rgba").to_vec(),
                128,
                128,
            );
            tauri::tray::TrayIconBuilder::new()
                    .icon(tray_icon)
                    .tooltip("NEAR — click to show")
                    .show_menu_on_left_click(false)
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        } = event {
                            if let Some(window) = tray.app_handle().get_webview_window("main") {
                                restart_notch_idle_watch(window);
                            }
                        }
                    })
                    .build(app)?;
            if let Some(window) = app.get_webview_window("main") {
                hide_webview_context_menu(&window);
                window.set_icon(tauri::image::Image::new(
                    include_bytes!("../icons/128x128.rgba"),
                    128,
                    128,
                ))?;
                window.set_focusable(false)?;
                window.set_always_on_top(true)?;
                window.set_skip_taskbar(true)?;
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                    }
                });
                restart_notch_idle_watch(window.clone());
                let startup_marker = app.path().app_config_dir()?.join("startup-preference-initialized");
                if !cfg!(debug_assertions) && !startup_marker.exists() {
                    use tauri_plugin_autostart::ManagerExt;
                    app.autolaunch().enable().map_err(std::io::Error::other)?;
                    if let Some(parent) = startup_marker.parent() { std::fs::create_dir_all(parent)?; }
                    std::fs::write(startup_marker, b"enabled")?;
                }
                if let Ok(Some(monitor)) = window.primary_monitor() {
                    let area = monitor.position();
                    let size = monitor.size();
                    let width = window.outer_size()?.width as i32;
                    let x = area.x + (size.width as i32 - width) / 2;
                    window.set_position(tauri::PhysicalPosition::new(x, area.y))?;
                }
            }
            for window in app.webview_windows().into_values() {
                if window.label() != "main" {
                    hide_webview_context_menu(&window);
                    window.set_icon(tauri::image::Image::new(
                        include_bytes!("../icons/128x128.rgba"),
                        128,
                        128,
                    ))?;
                }
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:near.db", migrations)
                .build(),
        )
        .invoke_handler(|invoke| {
            if !access::public_command(invoke.message.command()) && access::require().is_err() {
                invoke.resolver.reject("NEAR access is locked.");
                return true;
            }
            let handler: fn(tauri::ipc::Invoke<tauri::Wry>) -> bool = tauri::generate_handler![access::access_status, access::access_refresh, access::access_open_landing, access_data::access_export_data, access_data::access_delete_data, access_data::db_select, access_data::db_execute, media::media_state, media::media_control, media::media_play_youtube, media::media_play_spotify, music::resolve_youtube_music, greet, get_main_monitor, set_notch_bounds, set_notch_mouse_control, set_notch_auto_hide_seconds, get_start_at_login, set_start_at_login, exit_near, chatgpt_begin_login, chatgpt_status, chatgpt_profiles, chatgpt_select_profile, chatgpt_disconnect, prepare_chatgpt, chatgpt_reply, whisper_model_status, download_whisper_model, cancel_whisper_model_download, prepare_whisper_model, transcribe_near_audio, voice_models::list_near_voices, voice_models::download_near_voice, voice_models::prepare_near_voice, voice_models::synthesize_near_voice, bible_resources::list_near_bibles, bible_resources::download_near_bible];
            handler(invoke)
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                voice_models::shutdown_voice();
            }
        });
}
