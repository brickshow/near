// Keep the opening sentence small so playback can begin before a long reply is
// synthesized. Strip visual Markdown syntax before passing text to speech.
export function cleanSpeechText(text: string): string {
  return text
    .replace(/```[^\n]*\n?([\s\S]*?)```/gu, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gmu, "")
    .replace(/^\s{0,3}>\s?/gmu, "")
    .replace(/^\s*[-*+]\s+/gmu, "")
    .replace(/^\s*\d+[.)]\s+/gmu, "")
    .replace(/\*\*|__|~~|[*_`]/gu, "")
    .replace(/\\([\\`*_{}\[\]()#+.!-])/gu, "$1")
    .replace(/\s+/gu, " ")
    .trim();
}

// Streaming replies can contain long sentences. Start speaking at a complete
// word boundary instead of waiting indefinitely for sentence punctuation.
export function speechChunkEnd(text: string, limit: number, final = false): number {
  const sentence = /[.!?]["'”’)}\]]*\s/u.exec(text);
  const sentenceEnd = sentence ? sentence.index + sentence[0].length : 0;
  if (sentenceEnd && sentenceEnd <= limit) return sentenceEnd;
  if (text.length > limit) {
    for (let index = limit; index > 0; index -= 1) {
      if (/\s/u.test(text[index])) return index + 1;
    }
    // A single long word must stay intact, even when tokens split that word.
    const nextSpace = /\s/u.exec(text.slice(limit));
    if (nextSpace) return limit + nextSpace.index + 1;
  }
  return final ? text.length : 0;
}

export function splitSpeechText(text: string): string[] {
  const cleaned = cleanSpeechText(text);
  const sentences = cleaned.split(/(?<=[.!?]["'”’')\]]?)\s+/u);
  const chunks: string[] = [];
  for (const sentence of sentences) {
    let remaining = Array.from(sentence);
    while (remaining.length) {
      const limit = chunks.length === 0 ? 160 : 300;
      let end = Math.min(limit, remaining.length);
      if (end < remaining.length) {
        const boundary = remaining.slice(0, end + 1).lastIndexOf(" ");
        if (boundary > 0) end = boundary;
      }
      const chunk = remaining.slice(0, end).join("").trim();
      if (chunk) chunks.push(chunk);
      remaining = remaining.slice(end);
      if (remaining[0] === " ") remaining.shift();
    }
  }
  return chunks;
}
