import { invoke } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import Database from "@tauri-apps/plugin-sql";
import { BIBLE_BOOK_NAMES, type BiblePassage } from "./bibleReferences";

export type ScriptureReference = BiblePassage & { endVerse: number; translation: "ASV"; label: string };
export type ScriptureVerse = { number: number; text: string };
type Catalog = { versions: { id: string; installed: boolean }[] };
let bible: Promise<Database> | undefined;

async function asv(): Promise<Database> {
  if (!bible) bible = (async () => {
    const catalog = await invoke<Catalog>("list_near_bibles");
    if (!catalog.versions.some(version => version.id === "asv" && version.installed)) throw new Error("The ASV Bible is not downloaded yet.");
    return Database.load(`sqlite:${await join(await appDataDir(), "bibles", "asv.sqlite")}`, { autoCreate: false });
  })().catch(error => { bible = undefined; throw error; });
  return bible;
}

export async function loadScripture(passage: BiblePassage): Promise<{ reference: ScriptureReference; verses: ScriptureVerse[] }> {
  const endVerse = passage.endVerse ?? passage.verse;
  if (!Number.isInteger(passage.book) || passage.book < 1 || passage.book > 66
    || !Number.isInteger(passage.chapter) || passage.chapter < 1 || passage.chapter > 150
    || !Number.isInteger(passage.verse) || passage.verse < 1 || passage.verse > 176
    || !Number.isInteger(endVerse) || endVerse < passage.verse || endVerse > 176 || endVerse - passage.verse > 29) {
    throw new Error("Choose a valid passage of up to 30 verses.");
  }
  const verses = await (await asv()).select<ScriptureVerse[]>(
    "SELECT number, text FROM verses WHERE book_id=$1 AND chapter=$2 AND number BETWEEN $3 AND $4 ORDER BY number",
    [passage.book, passage.chapter, passage.verse, endVerse],
  );
  if (verses.length !== endVerse - passage.verse + 1 || verses.some((verse, index) => verse.number !== passage.verse + index || !verse.text)) {
    throw new Error("That Scripture reference could not be verified in the installed ASV Bible.");
  }
  const label = `${BIBLE_BOOK_NAMES[passage.book - 1]} ${passage.chapter}:${passage.verse}${endVerse === passage.verse ? "" : `–${endVerse}`}`;
  return { reference: { ...passage, endVerse, translation: "ASV", label }, verses };
}
