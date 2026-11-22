export type LyricLine = { time: number; words: { time: number; text: string }[]; text: string };
const seconds = (minutes: string, value: string) => Number(minutes) * 60 + Number(value);
export function parseLyrics(input: string): LyricLine[] {
  const offset = Number(input.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0) / 1000;
  const lines: LyricLine[] = [];
  for (const line of input.split(/\r?\n/)) {
    const stamps = [...line.matchAll(/\[(\d+):([0-5]\d(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    const content = line.replace(/\[\d+:[0-5]\d(?:\.\d+)?\]/g, '').trim();
    const words = [...content.matchAll(/<(\d+):([0-5]\d(?:\.\d+)?)>([^<]*)/g)]
      .map(match => ({ time: seconds(match[1], match[2]) + offset, text: match[3] })).filter(word => word.text.trim());
    const text = content.replace(/<\d+:[0-5]\d(?:\.\d+)?>/g, '');
    if (!text.trim()) continue;
    for (const stamp of stamps) lines.push({ time: seconds(stamp[1], stamp[2]) + offset, text, words: words.slice().sort((a, b) => a.time - b.time) });
  }
  return lines.sort((a, b) => a.time - b.time);
}
export function lyricAt(lines: LyricLine[], position: number): LyricLine | undefined {
  let result: LyricLine | undefined;
  for (const line of lines) { if (line.time > position) break; result = line; }
  return result;
}
