"""Make frame-accurate Scene 3 excerpts from the numbered screen recordings.

Run from any working directory. The source files remain untouched.
"""

from pathlib import Path
import subprocess
import sys

import imageio_ffmpeg


project = Path(__file__).resolve().parents[1]
source = project / "screenrecord"
target = project / "public" / "captures" / "scene-3"
target.mkdir(parents=True, exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
selected = set(sys.argv[1:])

# Scene 3's narration and subtitles reserve these exact slot lengths.
excerpts = [
    ("2.talk_near.mp4", "01-talk.mp4", 0, 25),
    ("3.chat_with_near.mp4", "02-chat.mp4", 0, 19),
    ("4.bible.mp4", "03-bible-read-aloud.mp4", 12.4, 25),
    ("5.journey.mp4", "04-journey.mp4", 22, 25),
    ("6.notes.mp4", "05-notes-verse-link.mp4", 13, 30),
    ("7.music.mp4", "06-music-controls.mp4", 0, 21),
]

for source_name, output_name, start, duration in excerpts:
    if selected and output_name not in selected:
        continue
    subprocess.run(
        [
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-ss", str(start), "-i", str(source / source_name),
            "-t", str(duration),
            "-vf", "scale=1920:1080,setsar=1,fps=30",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            "-movflags", "+faststart", str(target / output_name),
        ],
        check=True,
    )
    print(f"{source_name} {start}s–{start + duration}s -> {output_name}", flush=True)

# Keep the complete music request at normal speed. Remove five seconds of idle
# browser loading between the request and the song, without changing playback speed.
voice_music = source / "2.talk_near.mp4"
voice_filter = ";".join([
    "[0:v]trim=start=12:end=30,setpts=PTS-STARTPTS[v0]",
    "[0:a]atrim=start=12:end=30,asetpts=PTS-STARTPTS[a0]",
    "[0:v]trim=start=35:end=60,setpts=PTS-STARTPTS[v1]",
    "[0:a]atrim=start=35:end=60,asetpts=PTS-STARTPTS[a1]",
    "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]",
    "[v]scale=1920:1080,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=0.067[video]",
])
if not selected or "08-voice-play-music.mp4" in selected:
    subprocess.run(
    [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(voice_music),
        "-filter_complex", voice_filter, "-map", "[video]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-frames:v", "1290",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart", str(target / "08-voice-play-music.mp4"),
    ],
        check=True,
    )
    print("2.talk_near.mp4 spoken suggestion + shortened browser load -> 08-voice-play-music.mp4", flush=True)

# Keep the calendar, event form, and saved event visible within its 22-second slot.
church = source / "8.church_reminders.mp4"
filter_graph = ";".join([
    "[0:v]trim=start=0:end=7,setpts=PTS-STARTPTS[v0]",
    "[0:a]atrim=start=0:end=7,asetpts=PTS-STARTPTS[a0]",
    "[0:v]trim=start=13:end=22,setpts=PTS-STARTPTS[v1]",
    "[0:a]atrim=start=13:end=22,asetpts=PTS-STARTPTS[a1]",
    "[0:v]trim=start=30:end=36,setpts=PTS-STARTPTS[v2]",
    "[0:a]atrim=start=30:end=36,asetpts=PTS-STARTPTS[a2]",
    "[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]",
    "[v]scale=1920:1080,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=0.067[video]",
])
if not selected or "07-church-calendar.mp4" in selected:
    subprocess.run(
    [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(church),
        "-filter_complex", filter_graph, "-map", "[video]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-frames:v", "660",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart", str(target / "07-church-calendar.mp4"),
    ],
        check=True,
    )
    print("8.church_reminders.mp4 calendar + form + saved event -> 07-church-calendar.mp4")
