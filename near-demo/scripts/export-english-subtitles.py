"""Burn reviewed English cues into an already edited MP4 and export a matching SRT."""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile


def timestamp(ms, ass=False):
    seconds, fraction = divmod(ms, 1000)
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if ass:
        return f"{hours}:{minutes:02}:{seconds:02}.{fraction // 10:02}"
    return f"{hours:02}:{minutes:02}:{seconds:02},{fraction:03}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    parser.add_argument("--cues", type=Path, required=True)
    parser.add_argument("--srt", type=Path, required=True)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--captions-only", action="store_true")
    args = parser.parse_args()
    cues = json.loads(args.cues.read_text(encoding="utf-8"))
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: English,Segoe UI,46,&H00E8F2F4,&H00E8F2F4,&H490D0B09,&H490D0B09,-1,0,0,0,100,100,0,0,3,7,0,2,90,90,54,1
Style: Panel,Segoe UI,42,&H00E8F2F4,&H00E8F2F4,&H490D0B09,&H490D0B09,-1,0,0,0,100,100,0,0,3,7,0,1,100,100,80,1
Style: UpperLeft,Segoe UI,42,&H00E8F2F4,&H00E8F2F4,&H490D0B09,&H490D0B09,-1,0,0,0,100,100,0,0,3,7,0,7,70,70,155,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events, subtitles = [], []
    last_end = 0
    for index, cue in enumerate(cues, 1):
        start, end, text = cue["startMs"], cue["endMs"], cue["text"]
        if not last_end <= start < end or not text.strip() or len(text.splitlines()) > 2:
            raise ValueError(f"Invalid cue {index}: {cue}")
        last_end = end
        subtitles.append(f"{index}\n{timestamp(start)} --> {timestamp(end)}\n{text}\n")
        placement = r"{\an8\pos(960,70)}" if cue.get("placement") == "top" else ""
        style = {"panel": "Panel", "upper-left": "UpperLeft"}.get(cue.get("placement"), "English")
        display = text.replace("\n", r"\N")
        events.append(f"Dialogue: 0,{timestamp(start, True)},{timestamp(end, True)},{style},,0,0,0,,{placement}{display}")
    source, target = args.source.resolve(), args.target.resolve()
    if source == target:
        raise ValueError("Source and output paths must differ")
    with tempfile.TemporaryDirectory(dir=target.parent) as work:
        work = Path(work)
        (work / "captions.ass").write_text(header + "\n".join(events), encoding="utf-8-sig")
        if args.captions_only:
            (work / "captions.ass").replace(target)
        else:
            subprocess.run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
                            "-map", "0:v:0", "-map", "0:a:0", "-vf", "ass=captions.ass",
                            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-threads", "3",
                            "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", "subtitled.mp4"],
                           cwd=work, check=True)
            (work / "subtitled.mp4").replace(target)
    args.srt.write_text("\n".join(subtitles), encoding="utf-8")


if __name__ == "__main__":
    main()
