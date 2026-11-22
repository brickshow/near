export const BIBLE_PROGRESS_KEY = "near.bible.asv.progress.v1";
export type BibleProgress = { book: number; chapter: number; verse: number };

export function loadBibleProgress(storage: Pick<Storage, "getItem">): BibleProgress | null {
  try {
    const value = JSON.parse(storage.getItem(BIBLE_PROGRESS_KEY) ?? "null");
    if (!value || !Number.isInteger(value.book) || value.book < 1 || value.book > 66
      || !Number.isInteger(value.chapter) || value.chapter < 1 || value.chapter > 150
      || !Number.isInteger(value.verse) || value.verse < 1 || value.verse > 176) return null;
    return { book: value.book, chapter: value.chapter, verse: value.verse };
  } catch { return null; }
}

export function saveBibleProgress(storage: Pick<Storage, "setItem">, progress: BibleProgress): boolean {
  try { storage.setItem(BIBLE_PROGRESS_KEY, JSON.stringify(progress)); return true; }
  catch { return false; }
}
