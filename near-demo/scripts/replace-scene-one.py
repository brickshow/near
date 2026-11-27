"""Replace the opening in the existing demo while preserving the later edit."""
from pathlib import Path
import subprocess
import imageio_ffmpeg

project = Path(__file__).resolve().parents[1]
output = project / "out"
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
opening = output / "scene-1-motion-preview.mp4"
original = output / "near-hackathon-demo.draft.mp4"
target = output / "near-hackathon-demo.motion-draft.mp4"

filter_graph = ";".join([
    "[0:v]ass=near-hackathon-demo.en.ass,setsar=1[first]",
    "[1:v]trim=start=45,setpts=PTS-STARTPTS,setsar=1[remaining]",
    "[first][remaining]concat=n=2:v=1:a=0[video]",
    "[0:a]atrim=duration=45,asetpts=PTS-STARTPTS[first_audio]",
    "[1:a]atrim=start=45,asetpts=PTS-STARTPTS[remaining_audio]",
    "[first_audio][remaining_audio]concat=n=2:v=0:a=1[audio]",
])
subprocess.run([
    ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
    "-i", str(opening), "-i", str(original),
    "-filter_complex", filter_graph,
    "-map", "[video]", "-map", "[audio]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-threads", "3",
    "-r", "30", "-frames:v", "9000", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
    str(target),
], cwd=output, check=True)
