import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { lyricAt, parseLyrics, type LyricLine } from "../../lib/timedLyrics";
import "./MusicPanel.css";

type Media = {
  source: string; title: string; artist: string; playing: boolean;
  position: number; duration: number; rate: number;
  canToggle: boolean; canNext: boolean; canPrevious: boolean;
};
const time = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;

export function MusicPanel({ onTalk }: { onTalk: () => void }) {
  const [media, setMedia] = useState<Media | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState(0);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricError, setLyricError] = useState("");
  const lyricContainer = useRef<HTMLParagraphElement>(null);
  const snapshot = useRef<{ media: Media; at: number } | null>(null);
  const track = media ? `${media.source}|${media.title}|${media.artist}` : "";
  const currentTrack = useRef(track);
  currentTrack.current = track;
  useEffect(() => {
    let active = true;
    let timer = 0;
    const poll = async () => {
      try {
        const result = await invoke<Media | null>("media_state");
        if (!active) return;
        setMedia(result); snapshot.current = result ? { media: result, at: performance.now() } : null;
        setPosition(result?.position ?? 0); setError("");
      } catch (cause) {
        if (active) { setError(String(cause)); setMedia(null); snapshot.current = null; }
      } finally {
        if (active) { setChecking(false); timer = window.setTimeout(poll, 1000); }
      }
    };
    void poll();
    const clock = window.setInterval(() => {
      const sample = snapshot.current;
      if (!sample) return;
      const elapsed = sample.media.playing ? (performance.now() - sample.at) / 1000 * sample.media.rate : 0;
      setPosition(Math.min(sample.media.duration || Infinity, sample.media.position + elapsed));
    }, 100);
    return () => { active = false; clearTimeout(timer); clearInterval(clock); };
  }, []);
  useEffect(() => {
    setLyricError("");
    try { setLyrics(parseLyrics(localStorage.getItem(`near.lyrics.v1:${track}`) ?? "")); }
    catch { setLyrics([]); }
  }, [track]);
  const control = async (action: string) => {
    if (!media || busy) return;
    setBusy(true);
    try { await invoke("media_control", { action, source: media.source, title: media.title }); }
    catch (cause) { setLyricError(String(cause)); }
    finally { setBusy(false); }
  };
  const importLyrics = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !track) return;
    const selectedTrack = track;
    try {
      if (file.size > 256_000) throw Error("Choose a lyrics file smaller than 256 KB.");
      const text = await file.text();
      if (selectedTrack !== currentTrack.current) return;
      const parsed = parseLyrics(text);
      if (!parsed.length) throw Error("This file has no timed lyrics. Use an LRC file with timestamps.");
      setLyrics(parsed); setLyricError("");
      try { localStorage.setItem(`near.lyrics.v1:${track}`, text); }
      catch { setLyricError("Lyrics loaded for this session; could not save them."); }
    } catch (cause) { setLyricError(String(cause)); }
  };
  const line = lyricAt(lyrics, position);
  const currentWord = line?.words.findIndex((word, index, words) => position >= word.time && (index === words.length - 1 || position < words[index + 1].time)) ?? -1;
  useEffect(() => {
    const container = lyricContainer.current;
    const active = container?.querySelector<HTMLElement>(".lyric-current");
    if (!container) return;
    container.scrollTop = active ? Math.max(0, active.offsetTop - 7) : 0;
  }, [line, currentWord]);
  if (!media) return <section className="music-empty" aria-label="Music player">
    <span className="music-disc" aria-hidden="true">&#9835;</span>
    <div><strong>{checking ? "Finding your player..." : "Your music, right here"}</strong><p role="status">{error || "Start a song in YouTube or your music app."}</p></div>
    <button onClick={onTalk}>Ask NEAR</button>
  </section>;
  return <section className="music-panel" aria-label="Music player">
    <div className="music-main">
      <span className={`music-disc ${media.playing ? "is-playing" : ""}`} aria-hidden="true">&#9835;</span>
      <div className="music-track"><strong title={media.title}>{media.title || "Untitled track"}</strong><span title={media.artist}>{media.artist || "System media player"}</span>
        <div className="music-timeline"><span>{time(position)}</span><progress aria-label="Song progress" value={position} max={media.duration || Math.max(1, position)} /><span>{media.duration ? time(media.duration) : "Live"}</span></div>
      </div>
      <div className="music-controls">
        <button aria-label="Previous track" title={media.canPrevious ? "Previous track" : "Previous is unavailable in this player"} disabled={busy || !media.canPrevious} onClick={() => void control("previous")}><ControlIcon kind="previous" /></button>
        <button className="music-toggle" aria-label={media.playing ? "Pause music" : "Play music"} disabled={busy || !media.canToggle} onClick={() => void control("toggle")}><ControlIcon kind={media.playing ? "pause" : "play"} /></button>
        <button aria-label="Next track" title={media.canNext ? "Next track" : "Next is unavailable in this player"} disabled={busy || !media.canNext} onClick={() => void control("next")}><ControlIcon kind="next" /></button>
      </div>
    </div>
    <div className="music-lyrics">
      <p ref={lyricContainer} style={{ position: "relative" }} role={lyricError ? "alert" : undefined}>{lyricError || (line ? (line.words.length ? line.words.map((word, index) => <span key={index} className={index === currentWord ? "lyric-current" : position >= word.time ? "lyric-past" : ""}>{word.text}</span>) : line.text) : lyrics.length ? "Waiting for lyrics..." : "Add timed lyrics for this song")}</p>
      <label title="Import an LRC file. Word highlighting requires Enhanced LRC word timestamps." className="music-import">{lyrics.length ? "Change lyrics" : "+ Lyrics"}<input type="file" accept=".lrc,.txt" aria-label="Import timed lyrics for this song" onChange={event => void importLyrics(event)} /></label>
    </div>
  </section>;
}

function ControlIcon({ kind }: { kind: "previous" | "next" | "pause" | "play" }) {
  return <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor" aria-hidden="true">
    {kind === "pause" ? <path d="M5 4h3v12H5zm7 0h3v12h-3z" /> : kind === "play" ? <path d="m6 3 11 7-11 7z" /> : kind === "previous" ? <path d="M4 4h2v12H4zm12 0L7 10l9 6z" /> : <path d="M14 4h2v12h-2zM4 4l9 6-9 6z" />}
  </svg>;
}
