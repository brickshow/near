use reqwest::blocking::Client;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::PathBuf,
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};

const ASV_URL: &str = "https://raw.githubusercontent.com/midvash/bible-data/9586bd8228a747962df1ee8692730422fb7eb2ec/versions/en/asv/asv.sqlite";
const ASV_SIZE: u64 = 5_505_024;
const ASV_SHA256: &str = "3d936e7f844bccc48522ec134190b1de2d9d2d2fdf0301a3a95b9df57c46a11c";
static DOWNLOAD_LOCK: Mutex<()> = Mutex::new(());
static DOWNLOAD_PROGRESS: Mutex<Option<DownloadProgress>> = Mutex::new(None);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    version_id: String,
    stage: String,
    downloaded_bytes: u64,
    total_bytes: u64,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleVersion {
    id: &'static str,
    name: &'static str,
    download_bytes: u64,
    installed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleCatalog {
    versions: Vec<BibleVersion>,
    download: Option<DownloadProgress>,
}

fn bible_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("bibles").join("asv.sqlite"))
}

fn is_installed(path: &PathBuf) -> bool {
    if fs::metadata(path).is_ok_and(|m| m.is_file() && m.len() == ASV_SIZE) {
        fs::read(path).is_ok_and(|bytes| format!("{:x}", Sha256::digest(bytes)) == ASV_SHA256)
    } else {
        false
    }
}

#[tauri::command]
pub fn list_near_bibles(app: tauri::AppHandle) -> Result<BibleCatalog, String> {
    let path = bible_path(&app)?;
    Ok(BibleCatalog {
        versions: vec![BibleVersion { id: "asv", name: "American Standard Version (ASV)", download_bytes: ASV_SIZE, installed: is_installed(&path) }],
        download: DOWNLOAD_PROGRESS.lock().map_err(|e| e.to_string())?.clone(),
    })
}

#[tauri::command]
pub async fn download_near_bible(app: tauri::AppHandle, version_id: String) -> Result<(), String> {
    if version_id != "asv" { return Err("Choose the ASV version from NEAR's setup.".into()); }
    let path = bible_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = DOWNLOAD_LOCK.try_lock().map_err(|_| "The ASV Bible is already downloading.")?;
        if is_installed(&path) { return Ok(()); }
        if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }

        let mut progress = DownloadProgress { version_id: "asv".into(), stage: "Connecting".into(), downloaded_bytes: 0, total_bytes: ASV_SIZE, error: None };
        let emit = |value: &DownloadProgress| {
            if let Ok(mut state) = DOWNLOAD_PROGRESS.lock() { *state = Some(value.clone()); }
            let _ = app.emit("near://bible-download", value);
        };
        emit(&progress);
        let temporary = path.with_extension("sqlite.part");
        let result = (|| {
            let client = Client::builder().connect_timeout(Duration::from_secs(20)).timeout(Duration::from_secs(600)).build().map_err(|e| e.to_string())?;
            let mut response = client.get(ASV_URL).send().and_then(|r| r.error_for_status()).map_err(|e| format!("ASV download failed. Check your connection and try again: {e}"))?;
            if response.content_length().is_some_and(|size| size != ASV_SIZE) { return Err("The ASV download has an unexpected size.".into()); }
            progress.stage = "Downloading ASV Bible".into();
            emit(&progress);
            let mut file = fs::File::create(&temporary).map_err(|e| format!("Could not save the ASV download: {e}"))?;
            let mut digest = Sha256::new();
            let mut buffer = [0u8; 65536];
            let mut last_event = Instant::now();
            loop {
                let count = response.read(&mut buffer).map_err(|e| format!("ASV download interrupted. Try again: {e}"))?;
                if count == 0 { break; }
                progress.downloaded_bytes += count as u64;
                if progress.downloaded_bytes > ASV_SIZE { return Err("The ASV download is larger than expected.".into()); }
                file.write_all(&buffer[..count]).map_err(|e| format!("Could not write the ASV download: {e}"))?;
                digest.update(&buffer[..count]);
                if last_event.elapsed() >= Duration::from_millis(150) { emit(&progress); last_event = Instant::now(); }
            }
            if progress.downloaded_bytes != ASV_SIZE || format!("{:x}", digest.finalize()) != ASV_SHA256 {
                return Err("The downloaded ASV Bible could not be verified. Please try again.".into());
            }
            file.sync_all().map_err(|e| e.to_string())?;
            if path.exists() { fs::remove_file(&path).map_err(|e| e.to_string())?; }
            fs::rename(&temporary, &path).map_err(|e| format!("Could not install the ASV Bible: {e}"))?;
            Ok(())
        })();
        if result.is_err() { let _ = fs::remove_file(&temporary); }
        progress.stage = if result.is_ok() { "Ready" } else { "Failed" }.into();
        progress.error = result.as_ref().err().cloned();
        emit(&progress);
        if let Ok(mut state) = DOWNLOAD_PROGRESS.lock() { *state = None; }
        result
    }).await.map_err(|e| e.to_string())?
}
