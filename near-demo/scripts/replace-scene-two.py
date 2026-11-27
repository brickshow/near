"""Replace Scene 2 and the closing voice in the subtitled five-minute draft."""
from pathlib import Path
import subprocess
import imageio_ffmpeg

project = Path(__file__).resolve().parents[1]
output = project / "out"
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
original = output / "near-hackathon-demo.motion-draft.mp4"
new_scene = output / "scene-2-preview.mp4"
new_closing = output / "scene-4-solo-preview.mp4"
target = output / "near-hackathon-demo.solo-draft.mp4"

filter_graph = ";".join([
    "[0:v]split=2[before_video][middle_video]",
    "[before_video]trim=end=45,setpts=PTS-STARTPTS[first]",
    "[1:v]tpad=stop_mode=clone:stop_duration=1,trim=end_frame=928,"
    "setpts=PTS+45/TB,ass=near-hackathon-demo.en.ass,setpts=PTS-45/TB[second]",
    "[middle_video]trim=start=75.933333:end=280,setpts=PTS-STARTPTS[third]",
    "[2:v]setpts=PTS+280/TB,ass=near-hackathon-demo.en.ass,setpts=PTS-280/TB[fourth]",
    "[first][second][third][fourth]concat=n=4:v=1:a=0[video]",
    "[0:a]asplit=2[before_audio][middle_audio]",
    "[before_audio]atrim=duration=45,asetpts=PTS-STARTPTS[a0]",
    "[1:a]atrim=duration=30,asetpts=PTS-STARTPTS[a1]",
    "[middle_audio]atrim=start=75:end=280,asetpts=PTS-STARTPTS[a2]",
    "[2:a]atrim=duration=20,asetpts=PTS-STARTPTS[a3]",
    "[a0][a1][a2][a3]concat=n=4:v=0:a=1[audio]",
])
subprocess.run([
    ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
    "-i", str(original), "-i", str(new_scene), "-i", str(new_closing),
    "-filter_complex", filter_graph, "-map", "[video]", "-map", "[audio]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-threads", "3",
    "-r", "30", "-frames:v", "9000", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
    str(target),
], cwd=output, check=True)
