"""Create a seamless local 205-second bed from Scene 2's existing music cue."""
from array import array
from pathlib import Path
import math
import sys
import wave

project = Path(__file__).resolve().parents[1]
source = project / "public/audio/near-meet-music.wav"
target = project / "public/audio/near-feature-walkthrough-music.wav"
duration_seconds = 205
fade_seconds = 1

with wave.open(str(source), "rb") as reader:
    channels = reader.getnchannels()
    sample_width = reader.getsampwidth()
    rate = reader.getframerate()
    if sample_width != 2:
        raise SystemExit("Expected the local music cue to be 16-bit PCM.")
    source_frames = reader.getnframes()
    source_samples = array("h")
    source_samples.frombytes(reader.readframes(source_frames))

if sys.byteorder != "little":
    source_samples.byteswap()
if channels < 1 or len(source_samples) != source_frames * channels:
    raise SystemExit("Unexpected source music channel/frame layout.")

fade_frames = rate * fade_seconds
fade_samples = fade_frames * channels
if source_frames <= fade_frames * 2:
    raise SystemExit("The source cue is too short for a smooth loop.")

samples = array("h", source_samples)
target_frames = rate * duration_seconds
while len(samples) // channels < target_frames:
    head = source_samples[:fade_samples]
    tail = samples[-fade_samples:]
    blended = array("h")
    for frame in range(fade_frames):
        phase = frame / max(1, fade_frames - 1)
        old_gain = math.cos(phase * math.pi / 2)
        new_gain = math.sin(phase * math.pi / 2)
        base = frame * channels
        for channel in range(channels):
            mixed = round(tail[base + channel] * old_gain + head[base + channel] * new_gain)
            blended.append(max(-32768, min(32767, mixed)))
    samples[-fade_samples:] = blended
    samples.extend(source_samples[fade_samples:])

del samples[target_frames * channels:]
if sys.byteorder != "little":
    samples.byteswap()
with wave.open(str(target), "wb") as writer:
    writer.setnchannels(channels)
    writer.setsampwidth(sample_width)
    writer.setframerate(rate)
    writer.writeframes(samples.tobytes())
print(f"Prepared {target.relative_to(project)} ({duration_seconds}s)")
