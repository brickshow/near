import { speakNear, stopNearVoice } from "./voice";

// Read one original verse at a time; cancellation also invalidates late callbacks.
export function createBibleReading(
  onVerse: (number: number | null) => void,
  onError: (message: string) => void,
  speak = speakNear,
  cancel = stopNearVoice,
) {
  let generation = 0;
  const stop = () => { generation++; cancel(); onVerse(null); };
  return {
    stop,
    read(verses: { number: number; text: string }[], start = 0, rate = 1, onCompleted: (number: number) => void = () => {}) {
      stop();
      const current = generation;
      const next = (index: number) => {
        if (current !== generation) return;
        const verse = verses[index];
        if (!verse) { onVerse(null); return; }
        onVerse(verse.number);
        const speech = speak(verse.text, undefined, { rate });
        if (!speech) { stop(); onError("Voice playback is unavailable. Choose a voice in NEAR's voice settings."); return; }
        speech.onend = () => {
          if (current !== generation) return;
          onCompleted(verse.number);
          next(index + 1);
        };
        speech.onerror = message => { if (current === generation) { stop(); onError(message); } };
      };
      next(start);
    },
  };
}
