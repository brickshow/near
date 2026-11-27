"""Align the reviewed English cues with the numbered screenrecord edit."""

import json
from pathlib import Path


project = Path(__file__).resolve().parents[1]
path = project / "src" / "english-captions.json"
cues = json.loads(path.read_text(encoding="utf-8"))

# These phrases describe actions absent from the supplied footage or come from
# the older capture. Keep the narration and captions aligned with the new edit.
remove = {
    124920, 126920, 131000, 136000, 142000,
    151160, 154030, 217500, 227940, 247380,
    253400, 257300, 261000, 276000,
    126570, 135240, 141600, 207350, 247400, 249000, 270900, 272450,
}
cues = [cue for cue in cues if cue["startMs"] not in remove]
cues += [
    {"startMs": 126570, "endMs": 129700, "text": "In the beginning God created\nthe heavens and the earth.", "placement": "panel"},
    {"startMs": 135240, "endMs": 141600, "text": "And the earth was waste and void,\nand darkness was upon the face", "placement": "panel"},
    {"startMs": 141600, "endMs": 143950, "text": "of the deep.", "placement": "panel"},
    {"startMs": 207350, "endMs": 209600, "text": "[Worship music begins]"},
    {"startMs": 249000, "endMs": 253000, "text": "Play music, Nothing Is Impossible\nby Planetshakers."},
    {"startMs": 272450, "endMs": 274650, "text": "[Worship music begins]", "placement": "upper-left"},
]
cues.sort(key=lambda cue: cue["startMs"])
for earlier, later in zip(cues, cues[1:]):
    if earlier["endMs"] > later["startMs"]:
        raise ValueError(f"Caption overlap: {earlier} / {later}")
path.write_text(json.dumps(cues, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Updated {path} with {len(cues)} cues")
