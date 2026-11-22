import { useEffect, useState } from "react";
import Database from "@tauri-apps/plugin-sql";

export type DailyVerse = { text: string; reference: string; translation: "ASV" };

export const DAILY_VERSE_FALLBACK: DailyVerse = {
  text: "Be still, and know that I am God: I will be exalted among the nations, I will be exalted in the earth.",
  reference: "Psalm 46:10",
  translation: "ASV",
};

const BOOK_NAMES = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
  "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah",
  "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah",
  "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum",
  "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians",
  "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
];

type VerseRow = { book_id: number; chapter: number; number: number; text: string };
type VerseCount = { count: number };
let asvDatabase: Promise<Database> | undefined;
let cachedDate = "";
let cachedVerse: Promise<DailyVerse> | undefined;

function getAsvDatabase(): Promise<Database> {
  asvDatabase ??= Database.load("sqlite:bibles/asv.sqlite", { autoCreate: false });
  return asvDatabase;
}

async function readDailyVerse(): Promise<DailyVerse> {
  const database = await getAsvDatabase();
  const [{ count } = { count: 0 }] = await database.select<VerseCount[]>("SELECT COUNT(*) AS count FROM verses");
  if (count <= 0) return DAILY_VERSE_FALLBACK;
  const today = new Date();
  const dayNumber = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86_400_000);
  const offset = dayNumber % count;
  const [verse] = await database.select<VerseRow[]>(
    "SELECT book_id, chapter, number, text FROM verses ORDER BY id LIMIT 1 OFFSET $1",
    [offset],
  );
  const bookName = verse && BOOK_NAMES[verse.book_id - 1];
  if (!verse?.text || !bookName) return DAILY_VERSE_FALLBACK;
  return { text: verse.text, reference: `${bookName} ${verse.chapter}:${verse.number}`, translation: "ASV" };
}

function loadDailyVerse(): Promise<DailyVerse> {
  const now = new Date();
  const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  if (dateKey !== cachedDate || !cachedVerse) {
    cachedDate = dateKey;
    cachedVerse = readDailyVerse().catch(() => DAILY_VERSE_FALLBACK);
  }
  return cachedVerse;
}

export function useDailyVerse(): DailyVerse {
  const [verse, setVerse] = useState(DAILY_VERSE_FALLBACK);
  useEffect(() => {
    let active = true;
    void loadDailyVerse().then((dailyVerse) => { if (active) setVerse(dailyVerse); });
    return () => { active = false; };
  }, []);
  return verse;
}
