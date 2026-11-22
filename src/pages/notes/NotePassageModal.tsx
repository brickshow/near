import { useEffect, useRef, useState } from "react";
import { BIBLE_BOOK_NAMES, type BiblePassage } from "../../lib/bibleReferences";
import { readDownloadedPassage, type PassageVerse } from "../../lib/noteBiblePassage";

type Props = { passage: BiblePassage; onClose: () => void };

export function NotePassageModal({ passage, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [verses, setVerses] = useState<PassageVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const title = `${BIBLE_BOOK_NAMES[passage.book - 1]} ${passage.chapter}:${passage.verse}${passage.endVerse === undefined ? "" : `-${passage.endVerse}`}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setVerses([]);
    void readDownloadedPassage(passage)
      .then(rows => { if (active) setVerses(rows); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [passage]);

  return <dialog ref={dialogRef} className="note-passage-dialog" aria-labelledby="note-passage-title" onClose={onClose}>
    <header><div><h2 id="note-passage-title">{title}</h2><small>American Standard Version / 1901</small></div><button type="button" aria-label="Close passage" onClick={() => dialogRef.current?.close()}>&times;</button></header>
    <article aria-busy={loading}>
      {loading && <p role="status">Opening passage...</p>}
      {error && <p className="notes-error" role="alert">{error}</p>}
      {!loading && !error && verses.map(verse => <p key={verse.number}><sup>{verse.number}</sup>{verse.text}</p>)}
    </article>
  </dialog>;
}
