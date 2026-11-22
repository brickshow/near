export const BIBLE_BOOK_NAMES = "Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation".split("|");

export type BiblePassage = { book: number; chapter: number; verse: number; endVerse?: number };
export type BibleReferenceMatch = { start: number; end: number; label: string; passage: BiblePassage };

const spokenNumbers: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const unitWords = "one|two|three|four|five|six|seven|eight|nine";
const tensWords = "twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety";
const numberPattern = `(?:\\d{1,3}|(?:${tensWords})(?:[-\\s](?:${unitWords}))?|${Object.keys(spokenNumbers).join("|")})`;
const aliases = new Map<string, number>();
for (const [index, name] of BIBLE_BOOK_NAMES.entries()) {
  aliases.set(name.toLowerCase(), index + 1);
  const numbered = /^([1-3]) (.+)$/.exec(name);
  if (numbered) {
    const ordinal = ["first", "second", "third"][Number(numbered[1]) - 1];
    const roman = ["i", "ii", "iii"][Number(numbered[1]) - 1];
    aliases.set(`${ordinal} ${numbered[2].toLowerCase()}`, index + 1);
    aliases.set(`${roman} ${numbered[2].toLowerCase()}`, index + 1);
  }
}
aliases.set("psalm", 19);
aliases.set("salmo", 19);
aliases.set("salmos", 19);
aliases.set("juan", 43);
aliases.set("song of songs", 22);

const bookPattern = [...aliases.keys()]
  .sort((a, b) => b.length - a.length)
  .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const referencePattern = new RegExp(
  `\\b(${bookPattern})\\s+(?:(?:chapter|chap\\.?|ch\\.?|kapitulo)\\s+)?(${numberPattern})\\s*(?::|,?\\s*(?:verses?|v\\.?|talata)\\s+|[ \\t]+)\\s*(${numberPattern})(?:\\s*[-–—]\\s*(${numberPattern}))?\\b`,
  "giu",
);

function parseNumber(value: string): number {
  if (/^\d+$/u.test(value)) return Number(value);
  const parts = value.toLowerCase().split(/[-\s]+/u);
  return parts.reduce((sum, part) => sum + (spokenNumbers[part] ?? 0), 0);
}

export function findBibleReferences(text: string): BibleReferenceMatch[] {
  const matches: BibleReferenceMatch[] = [];
  for (const match of text.matchAll(referencePattern)) {
    const book = aliases.get(match[1].toLowerCase());
    const chapter = parseNumber(match[2]);
    const verse = parseNumber(match[3]);
    const endVerse = match[4] ? parseNumber(match[4]) : undefined;
    if (!book || chapter < 1 || chapter > 150 || verse < 1 || verse > 176
      || (endVerse !== undefined && (endVerse < verse || endVerse > 176))) continue;
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      label: match[0],
      passage: { book, chapter, verse, ...(endVerse === undefined ? {} : { endVerse }) },
    });
  }
  return matches;
}

