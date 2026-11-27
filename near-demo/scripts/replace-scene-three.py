"""Assemble the no-zoom demo with revised subtitles and the male narration mix."""

from pathlib import Path
import subprocess

import imageio_ffmpeg


project = Path(__file__).resolve().parents[1]
output = project / "out"
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
previous = output / "near-hackathon-demo.solo-draft.mp4"
scene = output / "scene-3-nozoom.mp4"
closing = output / "scene-4-solo-preview.mp4"
audio = output / "near-demo-male-mix.mp3"
target = output / "near-hackathon-demo.mp4"

filter_graph = ";".join([
    "[0:v]trim=end_frame=2250,setpts=PTS-STARTPTS[first]",
    "[1:v]setpts=PTS+75/TB,ass=near-hackathon-demo.en.ass,setpts=PTS-75/TB[second]",
    "[2:v]trim=start_frame=150:end_frame=600,setpts=PTS-STARTPTS+285/TB,ass=near-hackathon-demo.en.ass,setpts=PTS-285/TB[third]",
    "[first][second][third]concat=n=3:v=1:a=0[video]",
])

subprocess.run([
    ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
    "-i", str(previous), "-i", str(scene), "-i", str(closing), "-i", str(audio),
    "-filter_complex", filter_graph, "-map", "[video]", "-map", "3:a:0",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-threads", "3",
    "-r", "30", "-frames:v", "9000", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart",
    str(target),
], cwd=output, check=True)
print(target)
