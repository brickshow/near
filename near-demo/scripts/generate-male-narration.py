"""Generate cue-aligned male narration with ElevenLabs, without saving the API key.

Run with an interactive terminal. `--sample 45000` generates one cue for review.
The full run creates four WAV tracks at the exact caption times.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import getpass
import json
from pathlib import Path
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import wave

import imageio_ffmpeg
import numpy as np


project = Path(__file__).resolve().parents[1]
captions = json.loads((project / "src" / "english-captions.json").read_text(encoding="utf-8"))
output = project / "out" / "male-narration-cues"
output.mkdir(parents=True, exist_ok=True)
audio_dir = project / "public" / "audio"
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
ffprobe = project / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"
voice_id = "nPczCjzI2devNBz1zQrb"  # Brian, an available male voice.
live_cue_starts = {126570, 135240, 141600}


def narration_cue(cue):
    return cue["startMs"] not in live_cue_starts and not cue["text"].startswith("[")


def spoken_text(cue):
    return cue["text"].replace("\n", " ").strip("“”‘’\"' ")


def generate(cue, key):
    dest = output / f"{cue['startMs']:06d}.mp3"
    if dest.exists() and dest.stat().st_size > 1000:
        return cue, dest
    payload = {
        "text": spoken_text(cue),
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.60,
            "similarity_boost": 0.78,
            "style": 0.10,
            "use_speaker_boost": True,
            "speed": 1.0,
        },
    }
    request = Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128",
        data=json.dumps(payload).encode("utf-8"),
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
        method="POST",
    )
    for attempt in range(5):
        try:
            with urlopen(request, timeout=90) as response:
                media = response.read()
            if len(media) < 1000:
                raise ValueError(f"Empty speech response for cue {cue['startMs']}")
            dest.write_bytes(media)
            return cue, dest
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 4:
                raise RuntimeError(f"ElevenLabs HTTP {error.code} at cue {cue['startMs']}") from None
        except URLError as error:
            if attempt == 4:
                raise RuntimeError(f"Network error at cue {cue['startMs']}: {error.reason}") from None
        time.sleep(2 ** attempt)
    raise RuntimeError(f"Could not generate cue {cue['startMs']}")


def duration(path):
    result = subprocess.run(
        [str(ffprobe), "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


def samples(path, target_seconds):
    raw_seconds = duration(path)
    # Preserve the voice's natural pace when it fits; a brief pause before the
    # next cue is preferable to unnaturally slowing a short phrase.
    speed = max(1.0, raw_seconds / target_seconds)
    result = subprocess.run(
        [ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(path),
         "-af", f"atempo={speed:.8f},aresample=48000",
         "-ar", "48000", "-ac", "1", "-f", "f32le", "-t", str(target_seconds), "pipe:1"],
        capture_output=True, check=True,
    )
    return np.frombuffer(result.stdout, dtype="<f4"), speed


def save_wav(path, values):
    pcm = (np.clip(values, -0.99, 0.99) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as output_wave:
        output_wave.setnchannels(1)
        output_wave.setsampwidth(2)
        output_wave.setframerate(48000)
        output_wave.writeframes(pcm.tobytes())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sample", type=int, help="Generate only this cue start time, in milliseconds")
    args = parser.parse_args()
    cues = [cue for cue in captions if narration_cue(cue)]
    if args.sample is not None:
        cues = [cue for cue in cues if cue["startMs"] == args.sample]
        if not cues:
            raise SystemExit(f"No spoken cue starts at {args.sample} ms")
    missing = [cue for cue in cues if not (output / f"{cue['startMs']:06d}.mp3").is_file()]
    key = getpass.getpass("ElevenLabs API key: ") if missing else ""
    if missing and not key:
        raise SystemExit("An ElevenLabs API key is required for uncached cues")
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(generate, cue, key): cue for cue in cues}
        for future in as_completed(futures):
            cue, _ = future.result()
            print(f"Generated {cue['startMs']} ms", flush=True)
    if args.sample is not None:
        return

    timeline = np.zeros(300 * 48000, dtype=np.float32)
    report = []
    for cue in cues:
        path = output / f"{cue['startMs']:06d}.mp3"
        target_seconds = (cue["endMs"] - cue["startMs"]) / 1000 - 0.06
        values, speed = samples(path, target_seconds)
        start = round(cue["startMs"] * 48)
        stop = min(start + len(values), len(timeline))
        timeline[start:stop] += values[:stop - start]
        report.append({"startMs": cue["startMs"], "text": spoken_text(cue), "speed": round(speed, 3)})

    for name, begin, end in [
        ("near-problem-male.wav", 0, 45),
        ("near-meet-male.wav", 45, 75),
        ("near-feature-male.wav", 75, 285),
        ("near-closing-male.wav", 285, 300),
    ]:
        save_wav(audio_dir / name, timeline[begin * 48000:end * 48000])
        print(f"Saved {name}", flush=True)
    (output / "cue-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
