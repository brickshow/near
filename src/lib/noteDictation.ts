import { localTranscription, type TranscriptionModel, type TranscriptionSession, type TranscriptUpdate } from "./transcription";

// Remove only recognizable non-speech captions, not sentences discussing music.
function cleanNoteSpeech(text: string): string {
  const caption = /^(?:(?:music(?:\s+is)?(?:\s+playing)?|playing\s+music|instrumental(?:\s+music)?|silence|applause)[\s.!?,]*)+$/iu;
  const clean = text.replace(/\[([^\]]+)\]|\(([^)]+)\)/gu, (whole, square: string | undefined, round: string | undefined) => caption.test((square ?? round ?? "").trim()) ? "" : whole)
    .replace(/[♪♫♬]/gu, "").trim();
  return caption.test(clean) ? "" : clean;
}

export type DictationPhase = "idle" | "starting" | "listening" | "stopping";
export type NoteDictationEngine = {
  modelStatus: () => Promise<TranscriptionModel>;
  prepare: () => Promise<void>;
  start: (onTranscript: TranscriptUpdate, onError: (error: Error) => void, options?: { deviceId?: string }) => Promise<TranscriptionSession>;
};
export type NoteDictationObserver = {
  onText: (text: string) => void;
  onPhase: (phase: DictationPhase) => void;
  onError: (message: string) => void;
};
export type NoteDictationStart = { existingText: string; microphoneId?: string };

export function createNoteDictation(
  observer: NoteDictationObserver,
  engine: NoteDictationEngine = localTranscription,
) {
  let generation = 0;
  let session: TranscriptionSession | null = null;
  let phase: DictationPhase = "idle";
  let prefix = "";
  let heardSpeech = false;
  const updatePhase = (next: DictationPhase) => { phase = next; observer.onPhase(next); };
  const append = (raw: string) => {
    const text = cleanNoteSpeech(raw);
    if (text) { heardSpeech = true; observer.onError(""); observer.onText(prefix + (prefix && !/\s$/.test(prefix) ? "\n" : "") + text); }
    return text;
  };
  const cancel = () => { generation++; session?.cancel(); session = null; updatePhase("idle"); };
  return {
    cancel,
    async start({ existingText, microphoneId = "" }: NoteDictationStart) {
      if (phase !== "idle") return;
      const current = ++generation;
      prefix = existingText;
      heardSpeech = false;
      observer.onError(""); updatePhase("starting");
      try {
        const model = await engine.modelStatus();
        if (current !== generation) return;
        if (!model.installed) throw Error("Open Talk to NEAR and download the speech model, then try dictation again.");
        await engine.prepare();
        if (current !== generation) return;
        const capture = await engine.start(
          text => { if (current === generation && text) append(text); },
          error => { if (current === generation) { cancel(); observer.onError(error.message); } },
          { deviceId: microphoneId },
        );
        if (current !== generation) { capture.cancel(); return; }
        session = capture; updatePhase("listening");
      } catch (error) {
        if (current === generation) { cancel(); observer.onError(String(error)); }
      }
    },
    async stop() {
      if (phase === "starting") { cancel(); return; }
      if (!session || phase !== "listening") return;
      const current = generation;
      const capture = session;
      updatePhase("stopping");
      try {
        const text = await capture.stop();
        if (current !== generation) return;
        append(text);
        session = null; updatePhase("idle");
        if (!heardSpeech) observer.onError(text.trim()
          ? "I couldn't make out speech. Check that the selected microphone is capturing your voice, then try again."
          : "No speech was recognized. Check the selected microphone and try again.");
      } catch (error) { if (current === generation) { cancel(); observer.onError(String(error)); } }
    },
  };
}
