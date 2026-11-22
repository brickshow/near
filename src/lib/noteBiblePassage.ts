import { invoke } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import Database from "@tauri-apps/plugin-sql";
import type { BiblePassage } from "./bibleReferences";

export type PassageVerse = { number: number; text: string };

export async function readDownloadedPassage(passage: BiblePassage): Promise<PassageVerse[]> {
  const catalog = await invoke<{ versions: { installed: boolean }[] }>("list_near_bibles");
  if (!catalog.versions[0]?.installed) {
    throw new Error("Download the ASV Bible in Settings > Offline Bible to view this verse.");
  }
  const path = await join(await appDataDir(), "bibles", "asv.sqlite");
  const db = await Database.load(`sqlite:${path}`, { autoCreate: false });
  const verses = await db.select<PassageVerse[]>(
    "SELECT number, text FROM verses WHERE book_id = $1 AND chapter = $2 AND number BETWEEN $3 AND $4 ORDER BY number",
    [passage.book, passage.chapter, passage.verse, passage.endVerse ?? passage.verse],
  );
  if (!verses.length || verses[0].number !== passage.verse
    || verses[verses.length - 1].number !== (passage.endVerse ?? passage.verse)) {
    throw new Error("That passage was not found in the downloaded ASV Bible.");
  }
  return verses;
}
