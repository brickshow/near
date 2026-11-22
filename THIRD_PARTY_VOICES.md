# Optional NEAR voice: Bryce

NEAR can download the unmodified Windows x64 Piper runtime from the official
[2023.11.14-2 release](https://github.com/rhasspy/piper/releases/tag/2023.11.14-2)
when a user installs the Bryce voice. It is stored in NEAR's app data, never
inside the installer. This Piper release is MIT licensed and includes ONNX
Runtime, piper-phonemize and eSpeak NG components. eSpeak NG is GPL licensed;
see the [upstream source and license](https://github.com/espeak-ng/espeak-ng).
The executable runs as a separate local process. Downloads are pinned and
checked with SHA-256 before installation.

The optional [Bryce medium voice model](https://huggingface.co/rhasspy/piper-voices/tree/83db48b532e009b2ba25ae4a1bea709d07693c3d/en/en_US/bryce/medium)
is downloaded from `rhasspy/piper-voices`, revision
`83db48b532e009b2ba25ae4a1bea709d07693c3d`, and is about 63.5 MB. Its model
card identifies it as U.S. English, one speaker, 22,050 Hz, with a public
domain license. NEAR retains that model card with the downloaded files.

Voice and engine files are optional additional resources. They are never
compiled into or bundled with the NEAR application. Keep upstream attribution
and licenses when redistributing downloaded resources.
