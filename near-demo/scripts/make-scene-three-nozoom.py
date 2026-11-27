"""Assemble Scene 3's original screen framing at the captured playback speed."""

from pathlib import Path
import subprocess

import imageio_ffmpeg


project = Path(__file__).resolve().parents[1]
captures = project / "public" / "captures" / "scene-3"
output = project / "out"
names = [
    "01-talk.mp4", "02-chat.mp4", "03-bible-read-aloud.mp4",
    "04-journey.mp4", "05-notes-verse-link.mp4", "06-music-controls.mp4",
    "07-church-calendar.mp4", "08-voice-play-music.mp4",
]
for name in names:
    if not (captures / name).is_file():
        raise FileNotFoundError(captures / name)

list_file = output / "scene-3-nozoom-sources.txt"
list_file.write_text(
    "".join(f"file '{(captures / name).as_posix()}'\n" for name in names),
    encoding="utf-8",
)
target = output / "scene-3-nozoom.mp4"
subprocess.run([
    imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y",
    "-f", "concat", "-safe", "0", "-i", str(list_file),
    "-i", str(output / "scene-3-screenrecord.mp4"),
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "copy", "-frames:v", "6300",
    "-movflags", "+faststart", str(target),
], check=True)
print(target)
