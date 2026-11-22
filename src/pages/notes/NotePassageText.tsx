import type { ReactNode } from "react";
import { findBibleReferences, type BiblePassage } from "../../lib/bibleReferences";

type Props = { text: string; onOpen: (passage: BiblePassage) => void };

export function NotePassageText({ text, onOpen }: Props) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of findBibleReferences(text)) {
    parts.push(text.slice(cursor, match.start));
    parts.push(<button
      type="button"
      className="note-passage-link"
      key={match.start}
      title={`Show ${match.label} from the downloaded Bible`}
      onClick={() => onOpen(match.passage)}
    >{match.label}</button>);
    cursor = match.end;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}
