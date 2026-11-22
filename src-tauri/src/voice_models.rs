use base64::{Engine, engine::general_purpose::STANDARD};
use reqwest::blocking::Client;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{BufRead, BufReader, Cursor, Read, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
        mpsc,
    },
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};

const RUNTIME_URL: &str =
    "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip";
const RUNTIME_HASH: &str = "f3c58906402b24f3a96d92145f58acba6d86c9b5db896d207f78dc80811efcea";
const RUNTIME_SIZE: u64 = 22_477_236;
const REVISION: &str = "83db48b532e009b2ba25ae4a1bea709d07693c3d";
const MODEL_SIZE: u64 = 63_531_379;
static DOWNLOAD_LOCK: Mutex<()> = Mutex::new(());
static DOWNLOAD_PROGRESS: Mutex<Option<DownloadProgress>> = Mutex::new(None);
static SPEECH_WORKER: Mutex<Option<PiperWorker>> = Mutex::new(None);
static SPEECH_SHUTTING_DOWN: AtomicBool = AtomicBool::new(false);

struct VoiceSpec {
    key: &'static str,
    speaker: &'static str,
    name: &'static str,
    description: &'static str,
    config_hash: &'static str,
    config_size: u64,
    card_hash: &'static str,
    card_size: u64,
}

const VOICES: &[VoiceSpec] = &[VoiceSpec {
    key: "en_US-bryce-medium",
    speaker: "bryce",
    name: "Bryce",
    description: "English (US) - Medium",
    config_hash: "7ceb1bc4af6d4e41b6d1edbb86c67e91e01eaa71f66db4cd0ae92ac704d415be",
    config_size: 4966,
    card_hash: "96042c4ddbd405f6e40e2938b069987f4016a35832114bbefed1ed04242ee532",
    card_size: 405,
}];

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    voice_id: String,
    stage: String,
    downloaded_bytes: u64,
    total_bytes: u64,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceInfo {
    id: String,
    name: &'static str,
    description: &'static str,
    download_bytes: u64,
    installed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceCatalog {
    supported: bool,
    voices: Vec<VoiceInfo>,
    download: Option<DownloadProgress>,
}

fn supported() -> bool {
    cfg!(all(target_os = "windows", target_arch = "x86_64"))
}
fn voice_spec(id: &str) -> Result<&'static VoiceSpec, String> {
    VOICES
        .iter()
        .find(|voice| id == format!("piper:{}", voice.key))
        .ok_or_else(|| "Unknown voice. Choose a voice from NEAR's setup.".into())
}
fn voice_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("voices"))
}
fn runtime_dir(root: &Path) -> PathBuf {
    root.join("piper-2023.11.14-2")
}
fn runtime_ready(root: &Path) -> bool {
    let dir = runtime_dir(root);
    [
        "piper.exe",
        "onnxruntime.dll",
        "piper_phonemize.dll",
        "espeak-ng.dll",
        ".ready",
    ]
    .iter()
    .all(|name| dir.join(name).is_file())
        && dir.join("espeak-ng-data").is_dir()
}
fn size_is(path: &Path, expected: u64) -> bool {
    fs::metadata(path).is_ok_and(|m| m.is_file() && m.len() == expected)
}
fn voice_ready(root: &Path, voice: &VoiceSpec) -> bool {
    let dir = root.join(voice.key);
    runtime_ready(root)
        && dir.join(".ready").is_file()
        && size_is(&dir.join(format!("{}.onnx", voice.key)), MODEL_SIZE)
        && size_is(
            &dir.join(format!("{}.onnx.json", voice.key)),
            voice.config_size,
        )
}

#[tauri::command]
pub fn list_near_voices(app: tauri::AppHandle) -> Result<VoiceCatalog, String> {
    let root = voice_root(&app)?;
    Ok(VoiceCatalog {
        supported: supported(),
        voices: VOICES
            .iter()
            .map(|v| VoiceInfo {
                id: format!("piper:{}", v.key),
                name: v.name,
                description: v.description,
                download_bytes: MODEL_SIZE
                    + v.config_size
                    + v.card_size
                    + if runtime_ready(&root) {
                        0
                    } else {
                        RUNTIME_SIZE
                    },
                installed: voice_ready(&root, v),
            })
            .collect(),
        download: DOWNLOAD_PROGRESS.lock().map_err(|e| e.to_string())?.clone(),
    })
}

// Every temporary directory is generated under the app-owned voice folder.
// Failed downloads and generated speech are removed, never treated as installed.
struct TemporaryDirectory(PathBuf);
impl TemporaryDirectory {
    fn new(root: &Path) -> Result<Self, String> {
        let path = root.join(format!(".temporary-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
        Ok(Self(path))
    }
}
impl Drop for TemporaryDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn download_file(
    client: &Client,
    url: &str,
    path: &Path,
    hash: &str,
    size: u64,
    progress: &mut DownloadProgress,
    emit: &impl Fn(&DownloadProgress),
) -> Result<(), String> {
    let mut response = client
        .get(url)
        .send()
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("Download failed. Check your connection and try again: {e}"))?;
    let mut file =
        fs::File::create(path).map_err(|e| format!("Could not save the download: {e}"))?;
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 65536];
    let mut count = 0u64;
    let mut last_event = Instant::now();
    loop {
        let read = response
            .read(&mut buffer)
            .map_err(|e| format!("Download interrupted. Try again: {e}"))?;
        if read == 0 {
            break;
        }
        count += read as u64;
        if count > size {
            return Err("The voice download has an unexpected size. Try again.".into());
        }
        file.write_all(&buffer[..read])
            .map_err(|e| format!("Could not save the download: {e}"))?;
        digest.update(&buffer[..read]);
        progress.downloaded_bytes += read as u64;
        if last_event.elapsed() > Duration::from_millis(150) {
            emit(progress);
            last_event = Instant::now();
        }
    }
    if count != size || format!("{:x}", digest.finalize()) != hash {
        return Err("The downloaded voice could not be verified. Please try again.".into());
    }
    file.sync_all().map_err(|e| e.to_string())?;
    emit(progress);
    Ok(())
}

fn install_voice(
    root: &Path,
    voice: &VoiceSpec,
    progress: &mut DownloadProgress,
    emit: &impl Fn(&DownloadProgress),
) -> Result<(), String> {
    if !supported() {
        return Err("Downloadable voices currently require Windows x64.".into());
    }
    if voice_ready(root, voice) {
        return Ok(());
    }
    let temp = TemporaryDirectory::new(root)?;
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;
    if !runtime_ready(root) {
        progress.stage = "Downloading voice engine".into();
        emit(progress);
        let archive = temp.0.join("piper.zip");
        download_file(
            &client,
            RUNTIME_URL,
            &archive,
            RUNTIME_HASH,
            RUNTIME_SIZE,
            progress,
            emit,
        )?;
        progress.stage = "Installing voice engine".into();
        emit(progress);
        let mut zip = zip::ZipArchive::new(fs::File::open(archive).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        let mut unpacked_size = 0u64;
        for index in 0..zip.len() {
            let entry = zip.by_index(index).map_err(|e| e.to_string())?;
            unpacked_size = unpacked_size.saturating_add(entry.size());
            if entry.enclosed_name().is_none() || entry.is_symlink() || unpacked_size > 256_000_000
            {
                return Err("Invalid voice-engine archive.".into());
            }
        }
        zip.extract(temp.0.join("runtime"))
            .map_err(|e| format!("Could not unpack the voice engine: {e}"))?;
        let staged = temp.0.join("runtime/piper");
        fs::write(
            staged.join("THIRD_PARTY_VOICES.md"),
            include_str!("../../THIRD_PARTY_VOICES.md"),
        )
        .map_err(|e| e.to_string())?;
        fs::write(staged.join(".ready"), RUNTIME_HASH).map_err(|e| e.to_string())?;
        let destination = runtime_dir(root);
        if destination.exists() {
            fs::remove_dir_all(&destination).map_err(|e| e.to_string())?;
        }
        fs::rename(staged, destination).map_err(|e| e.to_string())?;
        if !runtime_ready(root) {
            return Err("The downloaded voice engine is incomplete. Please try again.".into());
        }
    }
    let staged = temp.0.join("voice");
    fs::create_dir(&staged).map_err(|e| e.to_string())?;
    let base = format!(
        "https://huggingface.co/rhasspy/piper-voices/resolve/{REVISION}/en/en_US/{}/medium",
        voice.speaker
    );
    progress.stage = format!("Downloading {} voice", voice.name);
    emit(progress);
    for (name, hash, size) in [
        (
            format!("{}.onnx", voice.key),
            "dc9caa6c313199ffb5ac698b6e542fa6cba388aeaf2731e25262e33b9810aef1",
            MODEL_SIZE,
        ),
        (
            format!("{}.onnx.json", voice.key),
            voice.config_hash,
            voice.config_size,
        ),
        ("MODEL_CARD".into(), voice.card_hash, voice.card_size),
    ] {
        download_file(
            &client,
            &format!("{base}/{name}"),
            &staged.join(&name),
            hash,
            size,
            progress,
            emit,
        )?;
    }
    fs::write(
        staged.join(".ready"),
        "dc9caa6c313199ffb5ac698b6e542fa6cba388aeaf2731e25262e33b9810aef1",
    )
    .map_err(|e| e.to_string())?;
    let destination = root.join(voice.key);
    if destination.exists() {
        fs::remove_dir_all(&destination).map_err(|e| e.to_string())?;
    }
    fs::rename(staged, destination).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn download_near_voice(app: tauri::AppHandle, voice_id: String) -> Result<(), String> {
    let voice = voice_spec(&voice_id)?;
    let root = voice_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = DOWNLOAD_LOCK
            .try_lock()
            .map_err(|_| "Another voice is downloading. Wait for it to finish.")?;
        let mut progress = DownloadProgress {
            voice_id,
            stage: "Starting download".into(),
            downloaded_bytes: 0,
            total_bytes: MODEL_SIZE
                + voice.config_size
                + voice.card_size
                + if runtime_ready(&root) {
                    0
                } else {
                    RUNTIME_SIZE
                },
            error: None,
        };
        let emit = |p: &DownloadProgress| {
            if let Ok(mut state) = DOWNLOAD_PROGRESS.lock() {
                *state = Some(p.clone());
            }
            let _ = app.emit("near://voice-download", p);
        };
        emit(&progress);
        let result = install_voice(&root, voice, &mut progress, &emit);
        progress.stage = if result.is_ok() { "Ready" } else { "Failed" }.into();
        progress.error = result.as_ref().err().cloned();
        emit(&progress);
        if let Ok(mut state) = DOWNLOAD_PROGRESS.lock() {
            *state = None;
        }
        result
    })
    .await
    .map_err(|e| e.to_string())?
}

// Piper accepts one JSON request per line and keeps its model loaded between
// requests. Dropping the worker kills/reaps it; app exit also closes its stdin.
struct PiperWorker {
    root: PathBuf,
    voice_key: &'static str,
    child: Child,
    input: ChildStdin,
    replies: mpsc::Receiver<Result<String, String>>,
    temp: TemporaryDirectory,
}

impl PiperWorker {
    fn new(root: &Path, voice: &VoiceSpec) -> Result<Self, String> {
        let temp = TemporaryDirectory::new(root)?;
        let runtime = runtime_dir(root);
        let mut command = Command::new(runtime.join("piper.exe"));
        command
            .current_dir(&runtime)
            .arg("--model")
            .arg(root.join(voice.key).join(format!("{}.onnx", voice.key)))
            .args([
                "--json-input",
                "--quiet",
                "--length_scale",
                "0.97",
                "--sentence_silence",
                "0.15",
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(fs::File::create(temp.0.join("piper.log")).map_err(|e| e.to_string())?);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        let mut child = command
            .spawn()
            .map_err(|e| format!("Could not start the local voice: {e}"))?;
        let input = child.stdin.take().expect("Piper stdin is piped");
        let output = child.stdout.take().expect("Piper stdout is piped");
        let (sender, replies) = mpsc::channel();
        std::thread::spawn(move || {
            for line in BufReader::new(output).lines() {
                if sender.send(line.map_err(|e| e.to_string())).is_err() {
                    break;
                }
            }
        });
        Ok(Self {
            root: root.to_path_buf(),
            voice_key: voice.key,
            child,
            input,
            replies,
            temp,
        })
    }

    fn synthesize(&mut self, text: &str) -> Result<Vec<u8>, String> {
        // Request-owned files are deleted after each chunk, including failures.
        let request = TemporaryDirectory::new(&self.temp.0)?;
        let output = request.0.join("speech.wav");
        let message = serde_json::json!({ "text": text, "output_file": output });
        writeln!(self.input, "{message}")
            .and_then(|_| self.input.flush())
            .map_err(|e| format!("Could not send text to the local voice: {e}"))?;
        let deadline = Instant::now() + Duration::from_secs(120);
        let reply = loop {
            if SPEECH_SHUTTING_DOWN.load(Ordering::Relaxed) {
                return Err("NEAR is closing.".into());
            }
            match self.replies.recv_timeout(Duration::from_millis(50)) {
                Ok(reply) => break reply?,
                Err(mpsc::RecvTimeoutError::Timeout) if Instant::now() < deadline => continue,
                Err(error) => return Err(format!("The local voice stopped responding: {error}")),
            }
        };
        if Path::new(&reply) != output {
            return Err("The local voice returned an unexpected audio file.".into());
        }
        // Piper reports the filename just before closing its file stream. Wait
        // for a complete RIFF payload rather than ever returning a partial WAV.
        let deadline = Instant::now() + Duration::from_millis(250);
        loop {
            if let Ok(metadata) = fs::metadata(&output) {
                if metadata.len() > 32_000_000 {
                    return Err("The local voice returned oversized audio.".into());
                }
                let bytes = fs::read(&output).map_err(|e| e.to_string())?;
                if bytes.len() >= 44 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WAVE" {
                    let expected = u32::from_le_bytes(bytes[4..8].try_into().unwrap()) as usize + 8;
                    if bytes.len() == expected {
                        return normalize_voice_volume(bytes);
                    }
                }
            }
            if Instant::now() >= deadline {
                return Err("The local voice returned incomplete audio.".into());
            }
            std::thread::sleep(Duration::from_millis(2));
        }
    }
}

impl Drop for PiperWorker {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn prepared_worker<'a>(slot: &'a mut Option<PiperWorker>, root: &Path, voice: &VoiceSpec) -> Result<&'a mut PiperWorker, String> {
    if SPEECH_SHUTTING_DOWN.load(Ordering::Relaxed) {
        return Err("NEAR is closing.".into());
    }
    if !supported() {
        return Err("Downloadable voices currently require Windows x64.".into());
    }
    if !voice_ready(root, voice) {
        return Err("Download this voice in Voice settings first.".into());
    }
    let reusable = slot.as_mut().is_some_and(|worker| {
        worker.root == root
            && worker.voice_key == voice.key
            && matches!(worker.child.try_wait(), Ok(None))
    });
    if !reusable {
        *slot = None;
        *slot = Some(PiperWorker::new(root, voice)?);
    }
    Ok(slot.as_mut().unwrap())
}

#[tauri::command]
pub async fn prepare_near_voice(app: tauri::AppHandle, voice_id: String) -> Result<(), String> {
    let root = voice_root(&app)?;
    let voice = voice_spec(&voice_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut slot = SPEECH_WORKER.lock().map_err(|e| e.to_string())?;
        prepared_worker(&mut slot, &root, voice).map(|_| ())
    }).await.map_err(|e| e.to_string())?
}

fn synthesize(root: &Path, voice: &VoiceSpec, text: &str) -> Result<Vec<u8>, String> {
    if text.trim().is_empty() || text.chars().count() > 6000 {
        return Err("Voice text must be between 1 and 6,000 characters.".into());
    }
    let mut slot = SPEECH_WORKER.lock().map_err(|e| e.to_string())?;
    let result = prepared_worker(&mut slot, root, voice)?.synthesize(text);
    // A failed/timed-out request must not poison subsequent requests.
    if result.is_err() {
        *slot = None;
    }
    result
}

pub fn shutdown_voice() {
    SPEECH_SHUTTING_DOWN.store(true, Ordering::Relaxed);
    if let Ok(mut worker) = SPEECH_WORKER.lock() {
        *worker = None;
    }
}

fn normalize_voice_volume(bytes: Vec<u8>) -> Result<Vec<u8>, String> {
    let mut reader = hound::WavReader::new(Cursor::new(&bytes))
        .map_err(|e| format!("Invalid voice audio: {e}"))?;
    if reader.duration() == 0 {
        return Err("The local voice returned empty audio.".into());
    }
    let spec = reader.spec();
    if spec.sample_format != hound::SampleFormat::Int || spec.bits_per_sample != 16 {
        return Ok(bytes);
    }
    // Apply about 5 dB of gain, then use a soft limiter to keep peaks below clipping.
    const GAIN: f32 = 1.8;
    const CEILING: f32 = 30_500.0;
    let mut normalized = Cursor::new(Vec::with_capacity(bytes.len()));
    let mut writer = hound::WavWriter::new(&mut normalized, spec)
        .map_err(|e| format!("Could not adjust voice volume: {e}"))?;
    for sample in reader.samples::<i16>() {
        let sample = sample.map_err(|e| format!("Could not adjust voice volume: {e}"))?;
        let boosted = sample as f32 * GAIN;
        let limited = CEILING * (boosted / CEILING).tanh();
        writer
            .write_sample(limited.round().clamp(i16::MIN as f32, i16::MAX as f32) as i16)
            .map_err(|e| format!("Could not adjust voice volume: {e}"))?;
    }
    writer
        .finalize()
        .map_err(|e| format!("Could not finalize adjusted voice audio: {e}"))?;
    Ok(normalized.into_inner())
}

#[tauri::command]
pub async fn synthesize_near_voice(
    app: tauri::AppHandle,
    voice_id: String,
    text: String,
) -> Result<String, String> {
    let voice = voice_spec(&voice_id)?;
    let root = voice_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        synthesize(&root, voice, &text).map(|bytes| STANDARD.encode(bytes))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn volume_adjustment_preserves_audio_and_limits_peaks() {
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 22050,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut input = Cursor::new(Vec::new());
        let mut writer = hound::WavWriter::new(&mut input, spec).unwrap();
        for sample in [0_i16, 1000, -1000, i16::MAX, i16::MIN] {
            writer.write_sample(sample).unwrap();
        }
        writer.finalize().unwrap();
        let adjusted = normalize_voice_volume(input.into_inner()).unwrap();
        let mut reader = hound::WavReader::new(Cursor::new(adjusted)).unwrap();
        assert_eq!(reader.spec(), spec);
        let samples = reader
            .samples::<i16>()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(samples.len(), 5);
        assert_eq!(samples[0], 0);
        assert!(samples[1] > 1000 && samples[2] < -1000);
        assert!(samples.iter().all(|sample| sample.unsigned_abs() <= 30_500));
        assert!(normalize_voice_volume(vec![0; 44]).is_err());
    }

    #[test]
    #[ignore = "Uses an already installed Bryce model at NEAR_VOICE_TEST_ROOT; no downloads"]
    fn installed_voice_reuses_worker_and_recovers_after_exit() {
        let root = PathBuf::from(
            std::env::var_os("NEAR_VOICE_TEST_ROOT").expect("Set NEAR_VOICE_TEST_ROOT"),
        );
        let voice = &VOICES[0];
        assert!(voice_ready(&root, voice));
        let mut previous_pid = None;
        for label in ["cold", "warm", "restarted"] {
            let start = Instant::now();
            let bytes = synthesize(&root, voice, "Hello, Brix. I'm NEAR.").unwrap();
            let mut audio = hound::WavReader::new(Cursor::new(bytes)).unwrap();
            assert!(audio.duration() > audio.spec().sample_rate);
            assert!(
                audio
                    .samples::<i16>()
                    .any(|s| s.unwrap().unsigned_abs() > 500)
            );
            let mut worker = SPEECH_WORKER.lock().unwrap();
            let child = &mut worker.as_mut().unwrap().child;
            if label == "warm" {
                assert_eq!(
                    previous_pid,
                    Some(child.id()),
                    "Model should stay in the same process"
                );
                child.kill().unwrap();
                child.wait().unwrap();
            } else if label == "restarted" {
                assert_ne!(previous_pid, Some(child.id()));
            }
            previous_pid = Some(child.id());
            eprintln!("Bryce {label}: {:?}", start.elapsed());
        }
        *SPEECH_WORKER.lock().unwrap() = None;
    }

    #[test]
    #[ignore = "Uses the installed Bryce model at NEAR_VOICE_TEST_ROOT; no downloads"]
    fn prepared_voice_starts_without_cold_model_load() {
        let root = PathBuf::from(std::env::var_os("NEAR_VOICE_TEST_ROOT").expect("Set NEAR_VOICE_TEST_ROOT"));
        {
            let mut slot = SPEECH_WORKER.lock().unwrap();
            *slot = None;
            prepared_worker(&mut slot, &root, &VOICES[0]).unwrap();
        }
        // Preparation runs while the user records and the reply is generated.
        std::thread::sleep(Duration::from_secs(2));
        let start = Instant::now();
        let bytes = synthesize(&root, &VOICES[0], "Hello, Brix. I'm NEAR.").unwrap();
        let elapsed = start.elapsed();
        assert!(hound::WavReader::new(Cursor::new(bytes)).unwrap().duration() > 0);
        eprintln!("Bryce prepared first audio: {elapsed:?}");
        *SPEECH_WORKER.lock().unwrap() = None;
        assert!(elapsed < Duration::from_secs(1), "Prepared speech should avoid model startup on the response path");
    }

    #[test]
    fn rejects_unknown_voice_and_uninstalled_model() {
        assert!(voice_spec("../../arbitrary.exe").is_err());
        let root =
            std::env::temp_dir().join(format!("near-voice-missing-{}", uuid::Uuid::new_v4()));
        assert!(!voice_ready(&root, &VOICES[0]));
        assert!(synthesize(&root, &VOICES[0], "Hello").is_err());
    }

    #[test]
    #[ignore = "Downloads pinned voice files and runs the Windows speech engine"]
    fn downloads_and_speaks_offline() {
        let temp = TemporaryDirectory::new(&std::env::temp_dir()).unwrap();
        for voice in VOICES {
            let mut progress = DownloadProgress {
                voice_id: format!("piper:{}", voice.key),
                stage: String::new(),
                downloaded_bytes: 0,
                total_bytes: MODEL_SIZE
                    + voice.config_size
                    + voice.card_size
                    + if runtime_ready(&temp.0) {
                        0
                    } else {
                        RUNTIME_SIZE
                    },
                error: None,
            };
            install_voice(&temp.0, voice, &mut progress, &|_| {}).unwrap();
            assert_eq!(progress.downloaded_bytes, progress.total_bytes);
            assert!(voice_ready(&temp.0, voice));
            // Synthesis only reads installed files and never creates an HTTP client.
            let bytes = synthesize(&temp.0, voice, "Hello, I'm NEAR. I'm here with you.").unwrap();
            let mut reader = hound::WavReader::new(std::io::Cursor::new(bytes)).unwrap();
            assert!(reader.duration() > reader.spec().sample_rate);
            assert!(
                reader
                    .samples::<i16>()
                    .any(|s| s.unwrap().unsigned_abs() > 500)
            );
            let mut reused = progress.clone();
            reused.downloaded_bytes = 0;
            install_voice(&temp.0, voice, &mut reused, &|_| {
                panic!("Installed voices must not download again")
            })
            .unwrap();
            assert_eq!(reused.downloaded_bytes, 0);
        }
    }
}
