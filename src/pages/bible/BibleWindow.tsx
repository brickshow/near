import { loadBibleProgress, saveBibleProgress } from "../../lib/bibleProgress";
import { BIBLE_BOOK_NAMES } from "../../lib/bibleReferences";
import { createBibleReading } from "../../lib/bibleReading";
import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Database from "@tauri-apps/plugin-sql";
import "./BibleWindow.css";

const names = BIBLE_BOOK_NAMES;
type Book = { book_id: number; chapters: number };
type Verse = { number: number; text: string };
export function BibleWindow() {
  const [books, setBooks] = useState<Book[]>([]);
  const [saved, setSaved] = useState(() => loadBibleProgress(localStorage));
  const [saveError, setSaveError] = useState("");
  const [book, setBook] = useState(saved?.book ?? 1);
  const [chapter, setChapter] = useState(saved?.chapter ?? 1);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [closing, setClosing] = useState(false);
  const [fontSize, setFontSize] = useState(19);
  const [readingVerse, setReadingVerse] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState("");
  const [rate, setRate] = useState(1);
  const [reader] = useState(() => createBibleReading(setReadingVerse, setSpeechError));
  useEffect(() => {
    const stop = () => reader.stop();
    window.addEventListener("beforeunload", stop);
    return () => { window.removeEventListener("beforeunload", stop); stop(); };
  }, [reader]);
  useEffect(() => { reader.stop(); setSpeechError(""); }, [reader, book, chapter, attempt]);
  const read = (start = 0) => {
    setSpeechError("");
    reader.read(verses, start, rate, verse => {
      const progress = { book, chapter, verse };
      setSaved(progress);
      setSaveError(saveBibleProgress(localStorage, progress) ? "" : "Could not save your reading position on this device.");
    });
  };
  const db = useRef<Database | null>(null);
  const content = useRef<HTMLElement | null>(null);
  const close = () => { reader.stop(); setClosing(true); };
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => { if (isTauri()) void getCurrentWindow().close(); else window.close(); }, 240);
    return () => window.clearTimeout(timer);
  }, [closing]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    let active = true;
    setBusy(true); setError(""); setMissing(false);
    void (async () => {
      const catalog = await invoke<{ versions: { installed: boolean }[] }>("list_near_bibles");
      if (!active) return;
      if (!catalog.versions[0]?.installed) { setMissing(true); setBusy(false); return; }
      const path = await join(await appDataDir(), "bibles", "asv.sqlite");
      const connection = await Database.load(`sqlite:${path}`, { autoCreate: false });
      const items = await connection.select<Book[]>("SELECT book_id, MAX(chapter) AS chapters FROM verses GROUP BY book_id ORDER BY book_id");
      if (items.length !== 66 || items.some((b, i) => b.book_id !== i + 1)) throw new Error("The downloaded Bible has an unexpected book index.");
      if (active) {
        if (chapter > items[book - 1].chapters) { setChapter(1); setSaved(null); }
        db.current = connection; setBooks(items);
      }
    })().catch(e => { if (active) { setError(String(e)); setBusy(false); } });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    if (!db.current || !books.length) return;
    let active = true;
    setBusy(true); setVerses([]); setError("");
    void db.current.select<Verse[]>("SELECT number, text FROM verses WHERE book_id = $1 AND chapter = $2 ORDER BY number", [book, chapter])
      .then(rows => { if (active) { if (!rows.length) throw new Error("This chapter could not be read."); setVerses(rows); setBusy(false); content.current?.scrollTo(0, 0); } })
      .catch(e => { if (active) { setError(String(e)); setBusy(false); } });
    return () => { active = false; };
  }, [book, chapter, books]);
  const savedHere = saved?.book === book && saved.chapter === chapter ? saved.verse : null;
  const resumeIndex = savedHere === null ? -1 : verses.findIndex(v => v.number > savedHere);
  useEffect(() => {
    if (!verses.length) return;
    // Restore the saved location after the chapter has rendered, without starting audio.
    if (savedHere !== null) document.getElementById(`verse-${savedHere}`)?.scrollIntoView({ block: "center" });
  }, [verses]);
  const last = books[book - 1]?.chapters ?? 1;
  const move = (direction: number) => {
    if (direction > 0) { if (chapter < last) setChapter(chapter + 1); else if (book < books.length) { setBook(book + 1); setChapter(1); } }
    else if (chapter > 1) setChapter(chapter - 1);
    else if (book > 1) { setBook(book - 1); setChapter(books[book - 2].chapters); }
  };
  const download = async () => {
    setBusy(true); setError("");
    try { await invoke("download_near_bible", { versionId: "asv" }); setAttempt(v => v + 1); }
    catch (e) { setError(String(e)); setBusy(false); }
  };
  return <div className={`bible-reader ${closing ? "closing" : ""}`}>
    <header><div><h1>Holy Bible</h1><small>American Standard Version / 1901</small></div><button onClick={close} aria-label="Close Bible">&times;</button></header>
    <nav aria-label="Bible passage"><label>Book<select value={book} disabled={!books.length} onChange={e => { setBook(Number(e.target.value)); setChapter(1); }}><optgroup label="Old Testament">{books.slice(0,39).map(b => <option key={b.book_id} value={b.book_id}>{names[b.book_id-1]}</option>)}</optgroup><optgroup label="New Testament">{books.slice(39).map(b => <option key={b.book_id} value={b.book_id}>{names[b.book_id-1]}</option>)}</optgroup></select></label><label>Chapter<select value={chapter} disabled={!books.length} onChange={e => setChapter(Number(e.target.value))}>{Array.from({length:last}, (_,i) => <option key={i+1}>{i+1}</option>)}</select></label><button aria-label="Decrease text size" onClick={() => setFontSize(v => Math.max(16,v-1))}>A-</button><button aria-label="Increase text size" onClick={() => setFontSize(v => Math.min(28,v+1))}>A+</button></nav>
    <section className="bible-audio" aria-label="Read aloud controls">
      <button className="bible-play" disabled={busy || !!error || !verses.length || closing} onClick={() => readingVerse === null ? read() : reader.stop()}>{readingVerse === null ? "Read chapter" : "Stop reading"}</button>
      <label>Speed<select aria-label="Reading speed" value={rate} disabled={readingVerse !== null} onChange={e => setRate(Number(e.target.value))}>{[0.75, 1, 1.25, 1.5].map(value => <option key={value} value={value}>{value}x</option>)}</select></label>
      <span role="status">{readingVerse === null ? "NEAR voice" : `Reading verse ${readingVerse}`}</span>
    </section>
    {saved && <section className="bible-progress" aria-label="Saved reading position">
      <span>Last completed: {names[saved.book - 1]} {saved.chapter}:{saved.verse}</span>
      {resumeIndex >= 0 && readingVerse === null && !busy && !error && <button onClick={() => read(resumeIndex)}>Continue reading</button>}
    </section>}
    {saveError && <p className="bible-speech-error" role="alert">{saveError}</p>}
    {speechError && <p className="bible-speech-error" role="alert">{speechError}</p>}
    <main ref={content} aria-busy={busy}>
      {busy && <p role="status">{missing ? "Downloading the ASV Bible..." : "Opening Scripture..."}</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={() => setAttempt(v => v+1)}>Retry</button></div>}
      {missing && !busy && <div><h2>Your offline Bible</h2><p>Download the ASV Bible to read all 66 books here.</p><button onClick={() => void download()}>Download ASV / 5.5 MB</button></div>}
      {!busy && !error && verses.length > 0 && <article key={`${book}-${chapter}`} style={{fontSize}}><h2>{names[book-1]} <span>{chapter}</span></h2>{verses.map((v, index) => <p key={v.number} id={`verse-${v.number}`} className={[readingVerse === v.number ? "bible-verse-active" : "", savedHere === v.number ? "bible-verse-saved" : ""].join(" ")}><button className="bible-verse-number" aria-label={`Read from verse ${v.number}`} aria-pressed={readingVerse === v.number} onClick={() => read(index)}>{v.number}</button>{v.text}{savedHere === v.number && <span className="bible-saved-label">Last completed</span>}</p>)}<div className="bible-end" aria-hidden="true">&diams;</div></article>}
    </main>
    <footer><button disabled={!books.length || (book === 1 && chapter === 1)} onClick={() => move(-1)}>&larr; Previous</button><span>{names[book-1]} {chapter}</span><button disabled={!books.length || (book === books.length && chapter === last)} onClick={() => move(1)}>Next &rarr;</button></footer>
  </div>;
}
