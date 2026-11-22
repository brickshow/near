from pathlib import Path

path = Path("src-tauri/src/voice_models.rs")
source = path.read_text(encoding="utf-8")
start = source.index('const REVISION:')
end = source.index('#[derive(Clone, Serialize)]')
voice_catalog = '''const REVISION: &str = "83db48b532e009b2ba25ae4a1bea709d07693c3d";
const MODEL_SIZE: u64 = 63_531_379;
static DOWNLOAD_LOCK: Mutex<()> = Mutex::new(());
static DOWNLOAD_PROGRESS: Mutex<Option<DownloadProgress>> = Mutex::new(None);
static SPEECH_LOCK: Mutex<()> = Mutex::new(());

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

'''
source = source[:start] + voice_catalog + source[end:]
source = source.replace('voice.model_hash, MODEL_SIZE', '"dc9caa6c313199ffb5ac698b6e542fa6cba388aeaf2731e25262e33b9810aef1", MODEL_SIZE')
source = source.replace('fs::write(staged.join(".ready"), voice.model_hash)', 'fs::write(staged.join(".ready"), "dc9caa6c313199ffb5ac698b6e542fa6cba388aeaf2731e25262e33b9810aef1")')
path.write_text(source, encoding="utf-8", newline="")

path = Path("THIRD_PARTY_VOICES.md")
path.write_text('''# Optional NEAR voice: Bryce

NEAR can download the unmodified Windows x64 Piper runtime from the official
[2023.11.14-2 release](https://github.com/rhasspy/piper/releases/tag/2023.11.14-2)
when a user installs the Bryce voice. It is stored in NEAR's app data, never
inside the installer. This Piper release is MIT licensed and includes ONNX
Runtime, piper-phonemize and eSpeak NG components. eSpeak NG is GPL licensed;
see the [upstream source and license](https://github.com/espeak-ng/espeak-ng).
The executable runs as a separate local process. Downloads are pinned and
checked with SHA-256 before installation.

The optional [Bryce medium voice model](https://huggingface.co/rhasspy/piper-voices/tree/83db48b532e009b2ba25ae4a1bea709d07693c3d/en/en_US/bryce/medium)
is downloaded from `rhasspy/piper-voices`, revision
`83db48b532e009b2ba25ae4a1bea709d07693c3d`, and is about 63.5 MB. Its model
card identifies it as U.S. English, one speaker, 22,050 Hz, with a public
domain license. NEAR retains that model card with the downloaded files.

Voice and engine files are optional additional resources. They are never
compiled into or bundled with the NEAR application. Keep upstream attribution
and licenses when redistributing downloaded resources.
''', encoding="utf-8", newline="")
