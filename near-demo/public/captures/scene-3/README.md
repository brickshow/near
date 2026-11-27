# Scene 3 screen recordings

The numbered recordings in `near-demo/screenrecord/` are edited into these timed
captures by `scripts/prepare-screenrecord-captures.py`:

| Capture | Source | Edit |
| --- | --- | --- |
| `01-talk.mp4` | `2.talk_near.mp4` | Listening and NEAR response, 0–25 s |
| `02-chat.mp4` | `3.chat_with_near.mp4` | Chat prompt and reply, 0–19 s |
| `03-bible-read-aloud.mp4` | `4.bible.mp4` | Genesis 1 read-aloud, 12.4–37.4 s |
| `04-journey.mp4` | `5.journey.mp4` | Goal creation and saved state, 22–47 s |
| `05-notes-verse-link.mp4` | `6.notes.mp4` | Note edit and saved state, 13–43 s |
| `06-music-controls.mp4` | `7.music.mp4` | Player controls, 0–21 s |
| `07-church-calendar.mp4` | `8.church_reminders.mp4` | Calendar, form, and saved event montage |
| `08-voice-play-music.mp4` | `2.talk_near.mp4` | NEAR suggestion plus shortened browser load |

`1.meet_near.mp4` is used in Scene 2 as `public/captures/scene-2/meet-near.mp4`.
The source MP4s remain intact. Run `python scripts/prepare-screenrecord-captures.py`
from `near-demo/` to rebuild these edits. Pass a capture filename to rebuild
only that output.

The raw `screenrecord/` files are kept locally because one exceeds GitHub's
regular file limit. The edited captures in `public/captures/` are committed so
the Remotion composition can render from a fresh checkout.
