"""List available male ElevenLabs voices without persisting the API key.

Pass the key on stdin. Never put it on the command line or in the repository.
"""

import json
import sys
import getpass
from urllib.error import HTTPError
from urllib.request import Request, urlopen


key = (getpass.getpass("ElevenLabs API key: ") if sys.stdin.isatty() else sys.stdin.readline()).strip()
if not key:
    raise SystemExit("An ElevenLabs API key is required on stdin")

request = Request(
    "https://api.elevenlabs.io/v2/voices?gender=male&language=en&page_size=40",
    headers={"xi-api-key": key},
)
try:
    with urlopen(request, timeout=30) as response:
        data = json.load(response)
except HTTPError as error:
    raise SystemExit(f"ElevenLabs voice lookup returned HTTP {error.code}") from None

for voice in data.get("voices", []):
    labels = voice.get("labels") or {}
    print(voice.get("name"), voice.get("voice_id"), labels.get("gender"), labels.get("accent"), labels.get("use_case"))
