"""Replace the two 'we built NEAR' lines with this narrator's spoken 'I'."""
from pathlib import Path
import subprocess
import imageio_ffmpeg

project = Path(__file__).resolve().parents[1]
audio = project / "public" / "audio"
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
subprocess.run([
    ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
    "-i", str(audio / "meet-near-01.mp3"),
    "-i", str(audio / "near-feature-01-voice.mp3"),
    "-filter_complex",
    "[0:a]atrim=end=0.91,asetpts=PTS-STARTPTS[before];"
    "[1:a]atrim=start=7.82:end=8.02,asetpts=PTS-STARTPTS,volume=1.2[i];"
    "[0:a]atrim=start=1.06,asetpts=PTS-STARTPTS[after];"
    "[before][i][after]concat=n=3:v=0:a=1[voice]",
    "-map", "[voice]", "-c:a", "libmp3lame", "-q:a", "2",
    str(audio / "meet-near-01-solo.mp3"),
], check=True)
subprocess.run([
    ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
    "-i", str(audio / "near-closing-02.mp3"),
    "-i", str(audio / "near-feature-01-voice.mp3"),
    "-filter_complex",
    "[0:a]atrim=end=0.64,asetpts=PTS-STARTPTS[before];"
    "[1:a]atrim=start=7.82:end=8.02,asetpts=PTS-STARTPTS,volume=1.2[i];"
    "[0:a]atrim=start=0.78,asetpts=PTS-STARTPTS[after];"
    "[before][i][after]concat=n=3:v=0:a=1[voice]",
    "-map", "[voice]", "-c:a", "libmp3lame", "-q:a", "2",
    str(audio / "near-closing-02-solo.mp3"),
], check=True)
