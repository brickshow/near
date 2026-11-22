import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { deleteNote, listNotes, saveNote, type Note } from "../../lib/notes";
import { findBibleReferences, type BiblePassage } from "../../lib/bibleReferences";
import { NotePassageText } from "./NotePassageText";
import { NotePassageModal } from "./NotePassageModal";
import { AppModal, type AppModalContent } from "../../components/AppModal";
import "./NotesWindow.css";

type Draft = { id?: number; title: string; content: string };
export function NotesWindow() {
  const [view, setView] = useState<"list" | "reader" | "editor">("list");
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState<Draft>({ title: "", content: "" });
  const [original, setOriginal] = useState<Draft>(draft);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPassage, setSelectedPassage] = useState<BiblePassage | null>(null);
  const [dialog, setDialog] = useState<AppModalContent | null>(null);
  const noteTextarea = useRef<HTMLTextAreaElement>(null);
  const passageOverlay = useRef<HTMLSpanElement>(null);
  const dirty = draft.title !== original.title || draft.content !== original.content;
  const references = findBibleReferences(draft.content);
  const openPassage = (passage: BiblePassage) => setSelectedPassage(passage);
  useLayoutEffect(() => {
    if (passageOverlay.current && noteTextarea.current) {
      passageOverlay.current.scrollTop = noteTextarea.current.scrollTop;
    }
  }, [draft.content, view]);
  useEffect(() => { if (error) setDialog({ title: "Notes error", message: error }); }, [error]);
  useEffect(() => {
    let active = true;
    void listNotes().then(rows => {
      if (!active) return;
      setNotes(rows);

    }).catch(cause => { if (active) setError(String(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const attemptLeave = (action: () => void) => {
    if (!dirty) { action(); return; }
    setDialog({ title: "Discard changes?", message: "Your unsaved note changes will be lost.", confirmLabel: "Discard", danger: true, onConfirm: action });
  };
  const select = (next: Draft) => {
    if (busy) return;
    attemptLeave(() => {
      setDraft(next); setOriginal(next); setStatus(""); setError(""); setView(next.id === undefined ? "editor" : "reader");
    });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      const id = await saveNote(draft.title, draft.content, draft.id);
      const saved = { ...draft, id, title: draft.title.trim() };
      setDraft(saved); setOriginal(saved); setStatus("Saved on this device");
      setNotes(await listNotes()); setSearch(""); setView("reader");
      setDialog({ title: "Note saved", message: "Your note was saved on this device." });
    } catch (cause) { setError(String(cause)); }
    finally { setBusy(false); }
  };
  const removeConfirmed = async (id: number) => {
    setBusy(true); setError("");
    try {
      await deleteNote(id);
      const rows = await listNotes(); setNotes(rows);
      const blank = { title: "", content: "" };
      setDraft(blank); setOriginal(blank); setStatus("Note deleted"); setView("list");
      setDialog({ title: "Note deleted", message: "The note was permanently deleted." });
    } catch (cause) { setError(String(cause)); }
    finally { setBusy(false); }
  };
  const remove = (id: number, title: string) => {
    if (busy) return;
    setDialog({ title: "Delete note?", message: `Delete "${title}" permanently?`, confirmLabel: "Delete note", danger: true, onConfirm: () => void removeConfirmed(id) });
  };
  const visible = notes.filter(note => `${note.title} ${note.content}`.toLowerCase().includes(search.toLowerCase()));
  return <main className={`notes-window docked-panel personal-notes ${view === "list" ? "notes-list-page" : view === "reader" ? "notes-read-page" : "notes-edit-page"}`}>
    <header className="notes-header"><div><h1>{view === "list" ? "Notes" : view === "reader" ? "View note" : draft.id === undefined ? "Add note" : "Edit note"}</h1><p>{view === "list" ? "Your thoughts, saved in one place." : view === "reader" ? "Take a moment to revisit your thoughts." : "Write it down and save it for later."}</p></div><button aria-label="Close Notes" disabled={busy} onClick={() => attemptLeave(() => void getCurrentWindow().close())}>&times;</button></header>
    {view === "list" ? <>
    <div className="personal-notes-tools"><input aria-label="Search notes" placeholder="Search your notes..." value={search} onChange={event => setSearch(event.target.value)} /><button disabled={busy || loading} className="notes-primary" onClick={() => select({ title: "", content: "" })}>+ Add note</button></div>
    <nav className="personal-note-list note-card-grid" aria-label="Saved notes">{loading ? <p className="note-card-empty" role="status">Loading notes...</p> : !visible.length ? <p className="note-card-empty">{search ? "No matching notes." : "Your saved notes will appear here. Add a note to get started."}</p> : visible.map(note => {
      const updated = new Date(note.updated_at.includes("T") ? note.updated_at : `${note.updated_at.replace(" ", "T")}Z`);
      const validDate = Number.isFinite(updated.getTime());
      return <article className="note-card" key={note.id}>
        <button className="note-card-open" disabled={busy} aria-label={`Open note: ${note.title}`} onClick={() => select(note)}>
          <strong>{note.title}</strong>
          <span className="note-card-preview">{note.content.replace(/\s+/g, " ").slice(0, 220) || "Empty note"}</span>
        </button>
        <div className="note-card-footer">{validDate && <time dateTime={updated.toISOString()} title={`Updated ${updated.toLocaleString()}`}>{updated.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time>}<button className="note-card-delete" disabled={busy} aria-label={`Delete note: ${note.title}`} onClick={() => void remove(note.id, note.title)}>Delete</button></div>
      </article>;
    })}</nav>
    </> : <>
    <button className="notes-back" disabled={busy} onClick={() => attemptLeave(() => { setDraft(original); setView("list"); setError(""); })}>&larr; All notes</button>
    {view === "reader" ? <>
      <article className="personal-note-reader" aria-labelledby="note-reader-title">
        <h2 id="note-reader-title">{draft.title}</h2>
        <p>{draft.content ? <NotePassageText text={draft.content} onOpen={openPassage} /> : "This note is empty."}</p>
      </article>
      <div className="personal-note-footer">{draft.id !== undefined && <button disabled={busy} onClick={() => { if (draft.id !== undefined) void remove(draft.id, draft.title); }}>Delete note</button>}<button className="notes-primary" disabled={busy} onClick={() => { setStatus(""); setView("editor"); }}>Edit note</button></div>
    </> : <form className="personal-note-editor" onSubmit={event => void save(event)}>
      <label>Title<input autoFocus required maxLength={160} disabled={busy || loading} value={draft.title} placeholder="Give this thought a title" onChange={event => { setDraft({ ...draft, title: event.target.value }); setStatus(""); }} /></label>
      <label className="personal-note-content">Your note<span className="note-content-layer"><textarea ref={noteTextarea} className={references.length ? "has-passage-links" : ""} disabled={busy || loading} maxLength={100000} value={draft.content} placeholder="Write your note here..." onScroll={event => { if (passageOverlay.current) passageOverlay.current.scrollTop = event.currentTarget.scrollTop; }} onChange={event => { setDraft({ ...draft, content: event.target.value }); setStatus(""); }} />{references.length > 0 && <span className="note-content-overlay" ref={passageOverlay}><NotePassageText text={draft.content} onOpen={openPassage} /></span>}</span></label>
      <div className="personal-note-footer"><span role="status">{dirty ? "Unsaved changes" : status}</span><button type="button" disabled={busy} onClick={() => attemptLeave(() => { setDraft(original); setView(draft.id === undefined ? "list" : "reader"); setError(""); })}>Cancel</button>{draft.id !== undefined && <button type="button" disabled={busy} onClick={() => { if (draft.id !== undefined) void remove(draft.id, draft.title); }}>Delete</button>}<button type="submit" className="notes-primary" disabled={busy || loading || !draft.title.trim()}>{busy ? "Saving..." : "Save note"}</button></div>
    </form>}</>}
    {selectedPassage && <NotePassageModal passage={selectedPassage} onClose={() => setSelectedPassage(null)} />}
    {dialog && <AppModal {...dialog} onClose={() => setDialog(null)} />}
  </main>;
}
