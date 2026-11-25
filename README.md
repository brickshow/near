# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Windows development

In addition to Node.js, Rust and the Visual Studio C++ build tools, Whisper needs
libclang and CMake during compilation. With Python and pip installed, run once:

```powershell
npm run setup:windows
npm run tauri dev
```

The setup command installs pinned tools into the ignored `.build-tools` directory
and creates a local `.cargo/config.toml` so Cargo finds them in new terminals.
It does not change the system PATH. Python and these tools are build dependencies;
users of the compiled app do not need them. Do not set
`WHISPER_DONT_GENERATE_BINDINGS`: the bundled bindings are not suitable for Windows.

## Linux development and builds

On Ubuntu 24.04, install Tauri's native libraries plus the CMake and Clang tools
used to compile the local Whisper engine. This helper also installs Rust through
rustup if it is missing; `sudo` may prompt for your password:

```sh
npm run setup:linux
```

Install Node.js, then install the locked JavaScript packages before starting the
desktop app:

```sh
npm ci
npm run tauri dev
```

Create a Debian package on Linux with:

```sh
npm run tauri -- build --bundles deb
```

Build the package on the Linux distribution you intend to support. Native
WebKitGTK and system libraries are linked into the app. The global
`Ctrl+Shift+Space` shortcut is registered on X11; native Wayland sessions use
the tray icon to restore the NEAR window because global shortcut registration
is not available there.

## macOS development and builds

NEAR supports macOS on Apple Silicon and Intel. Install Xcode Command Line Tools,
Node.js, Rust via rustup, and the native Whisper build tools:

```sh
xcode-select --install
brew install cmake llvm
export LIBCLANG_PATH="$(brew --prefix llvm)/lib"
npm install
npm run tauri dev
```

To create a distributable `.app` and `.dmg` on a Mac:

```sh
npm run tauri -- build --bundles app,dmg
```

The build includes the macOS app icon and microphone permission prompt. ChatGPT
OAuth credentials are stored in the macOS Keychain. The optional bundled Bryce
voice and system-wide media session controls are currently Windows-only; macOS
uses its system speech voices, and NEAR opens YouTube playback in the browser.
Build macOS packages on macOS because Apple’s SDK and signing tools are required.

Voice transcription runs locally in short overlapping audio windows. The optional
multilingual Whisper tiny Q5_1 model is about 32 MB and downloads only when the user
chooses. The model loads into memory when recording starts; microphone audio is not
uploaded or saved. Sending a reviewed transcript to ChatGPT requires internet.

Live transcription uses a shorter Whisper encoder context for audio up to five
seconds, with automatic language detection preserved. Model preparation primes
this context before recording. Longer audio retains Whisper's full context.

To measure local transcription throughput after a dev build, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/benchmark-transcription.ps1
```

The benchmark runs the same inference function as the app. It uses the installed
Whisper model and generates a fixed English fixture with Bryce, storing benchmark
artifacts in the ignored `.build-tools` folder. It checks key phrases and fails if
average processing exceeds the 1.5-second window arrival interval. To measure
your own mono PCM16 WAV instead, pass `-AudioPath path/to/sample.wav`; phrase checks
apply only to the generated fixture. Timing and recognition quality depend on
the machine, language, and recording. The benchmark does not access the microphone
or send audio over the network.

## Voice reply latency

Opening the listening screen prepares the ChatGPT connection/model catalog and
starts the installed Piper worker while the user records. Voice requests prefer
GPT-6 Luna with `reasoning.effort: none` when it is available; other accounts fall
back to an available model and its supported reasoning settings. Ordinary text
chat uses the account's default visible model. See the
[OpenAI model settings](https://developers.openai.com/api/docs/guides/latest-model).

While audio is being prepared, the listening screen shows a typing indicator;
captions appear progressively during speech. The voice stream sends a
complete sentence immediately or a complete opening phrase after 500 ms when
enough text has arrived, instead of waiting for the server to close the stream.

The opt-in response benchmark uses the existing sign-in and sends two short
synthetic prompts. It reports preparation separately from time to first text
and checks a three-second response target. Internet timings can vary:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --lib response_benchmark::response_latency -- --ignored --nocapture
```

The installed-voice benchmark measures synthesis after preparation; it does not
play sound or download anything:

```powershell
$env:NEAR_VOICE_TEST_ROOT = Join-Path $env:APPDATA 'com.app.near/voices'
cargo test --manifest-path src-tauri/Cargo.toml --lib prepared_voice_starts_without_cold_model_load -- --ignored --nocapture
```

On November 17, 2026, the short greeting benchmark measured first response text
at 4.65–4.73 seconds with the previous default model, and 1.68–1.97 seconds with
the prepared voice path. The same Bryce greeting took 1.54 seconds from a cold
worker and 0.33 seconds after preparation. These are separate component timings,
not a measured microphone-to-playback total. The faster voice model uses less
deliberation; complex answers and other network conditions can behave differently.

## Optional NEAR voice

The voice setup offers only the Bryce Piper voice shown in the samples page. The
`Download Bryce` button installs the voice model and speech engine, about 86 MB
on first download, into the user's app data folder. NEAR does not bundle these
files in its build or installer. Once selected, Bryce previews and plays NEAR's
replies locally.

## Optional ASV Bible

Setup offers the American Standard Version (ASV) as the only Bible download. It
downloads a verified 5.5 MB SQLite resource into the user's app data folder.
The Bible data stays out of the application build and installer; users can
download it later or skip it during setup. The ASV is public domain. See
[`THIRD_PARTY_BIBLES.md`](THIRD_PARTY_BIBLES.md) for source and version details.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Offline Bible reader

The Home ? Bible button opens a separate reader docked to the right edge of the current monitor's work area. The reader uses the verified downloaded ASV SQLite database under the app data directory; it never generates or paraphrases verse text. If the download is missing, the reader offers the existing verified ASV download.

Select an Old or New Testament book and chapter, use Previous/Next to move across chapter and book boundaries, or adjust the reading text size. Escape or the close button dismisses the reader. Entrance, exit, and chapter transitions respect reduced-motion settings.

Validation: all 66 book IDs and 1,189 chapters in the installed source were checked; every chapter loads nonempty verse text with unique ordered verse numbers. The database integrity check, TypeScript production build, and native `cargo check --lib` passed.

The Bible reader shares NEAR's dark navy, cyan, and mint styling. Read chapter uses the selected NEAR voice (downloaded Piper or the system voice fallback), highlights the current verse, and supports 0.75x?1.5x playback. Click a verse number to read from that verse. Stop, chapter navigation, and closing the window cancel playback; stale callbacks cannot restart it. Playback errors are shown separately from Bible loading errors.

Read-aloud regression checks: `node --test scripts/bible-reading.test.mjs scripts/voice-playback.test.mjs`.

Reading progress is saved locally after each verse finishes playing. Reopening the reader restores the saved book/chapter and scrolls to the persistent ?Last completed? highlight. Continue reading starts with the next verse in that chapter; use Next after a completed chapter. Interrupted verses are not marked complete. The original ASV database is never modified.

## Voice music commands

Say ?Play me a music? or ?Patukar og kanta?, then hold N again and say the song title (and artist). NEAR asks for the title, searches YouTube, and opens the first video result in the default browser with autoplay requested. Direct requests such as ?Play Amazing Grace? also work. Say ?cancel? or ?ayaw na? to cancel a pending title request. The previous recording transcript is cleared after a successful turn so follow-up titles stay separate.

YouTube search uses its public results page; consent pages or layout changes fall back to opening the search results with an honest spoken explanation. Browser autoplay restrictions can require clicking Play. NEAR cannot confirm playback in an external browser or guarantee that the first result is the intended recording. No browser security settings are changed.

Validation: `node --test scripts/music-commands.test.mjs`; native parser and live lookup checks: `cargo test --manifest-path src-tauri/Cargo.toml --lib music::tests -- --include-ignored --nocapture`. Live lookup makes a network request but does not open or play audio.

## Music panel

The Home navigation now has Music in place of Worship. Its compact player reads the current Windows media session, showing track/artist, playback position, and play/pause, previous, and next controls. These control the external player, including supported YouTube browser sessions; unsupported controls stay disabled. Playback commands verify the displayed source and track are still current before sending an action. The panel refreshes once per second and stops polling when closed.

Use + Lyrics to import a matching LRC file for the current track. Enhanced LRC `<mm:ss.xx>` word timestamps enable word highlighting; ordinary LRC provides line synchronization only. Lyrics follow playback/seek position, are stored locally per track, and never use invented word timestamps. Windows media metadata does not provide song lyrics, so automatic lyric downloading is not included. Timing accuracy depends on the player's reported timeline and the supplied lyric file.

Checks: `node --test scripts/timed-lyrics.test.mjs`. Read-only live Windows API check: `cargo test --manifest-path src-tauri/Cargo.toml --lib media::tests::reads_live_session -- --ignored --nocapture`.

## Church Calendar and reminders

Church opens a dedicated right-docked Church Calendar with a month calendar, event markers, day agenda, All events, search, and an event editor for title, local date/time, location, event details, and reminder timing. Events and alert acknowledgments persist in SQLite. The default is 15 minutes before plus at the event time; 5/30/60 minutes, at-time-only, and Off are also available.

The main NEAR window checks every 10 seconds and opens a separate floating reminder window, even when Church Calendar is closed. Alerts can be dismissed or snoozed for 10 minutes. Delivered/dismissed stages are deduplicated; deleted, disabled, and rescheduled events do not retain stale alerts. On restart, unread alerts return and missed events receive one alert rather than both stages. Keep NEAR running to get alerts at the scheduled time: reminders are not an OS background service and cannot fire while the computer sleeps or NEAR is quit.

Checks: `node --test scripts/calendar.test.mjs` runs the actual calendar persistence and queue code against SQLite with the real migrations, covering reminder boundaries, duplicates, snooze, edits, deletion, missed events, and calendar dates.

## Personal Notes

Notes is a separate right-docked editor with search, create, save, edit, and delete. Personal notes use the existing `notes` table and never modify the church `events` table. Unsaved changes are indicated, and switching notes or closing with the close button asks before discarding them.

Bible, Notes, and Church Calendar share the same 460px right-edge docking geometry, work-area height, and frameless always-on-top behavior. Reopening an existing panel repositions it on the current monitor. Existing calendar events and their reminder settings are preserved.

Checks: `node --test scripts/notes.test.mjs scripts/calendar.test.mjs`.

Notes opens to the saved-note list by default. Add note opens a separate editor view in the same dock; selecting a note opens a read-only view. Edit note explicitly opens editing mode; saving returns to the read-only view. Dictate note uses the installed local Whisper model, appends recognized speech to the existing body without repeating partial results, and offers Stop dictation. Stop finishes pending transcription before Save becomes available. Starting capture can be canceled; late capture callbacks cannot alter another note. Missing speech-model or microphone errors leave typed text intact. The native microphone allowlist includes only the main and Notes windows.

Dictation lifecycle checks: `node --test scripts/note-dictation.test.mjs scripts/notes.test.mjs`.

Notes dictation now lets you choose an input microphone (remembered on this device). Recognizable music/silence captions are excluded from dictated notes, with an explanatory message when only background sound is recognized; sentences discussing music are preserved. This does not recover speech the model failed to hear. Choose the actual microphone rather than a loopback input if your transcript only reports background music.
