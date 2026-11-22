import { invoke } from "@tauri-apps/api/core";
import { cleanSpeechText, speechChunkEnd, splitSpeechText } from "./speechChunks";

export const NEAR_VOICE_KEY = "near.assistant.voice";

export function prepareNearVoice(preferredVoice = localStorage.getItem(NEAR_VOICE_KEY) ?? ""): Promise<void> {
  return preferredVoice.startsWith("piper:")
    ? invoke<void>("prepare_near_voice", { voiceId: preferredVoice })
    : Promise.resolve();
}

export type NearSpeech = {
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((message: string) => void) | null;
};

export type NearSpeechStream = NearSpeech & {
  status: "queued" | "speaking" | "finished" | "stopped" | "error";
  errorMessage: string | null;
  onCaptionProgress: ((sentence: string, progress: number) => void) | null;
  push: (delta: string) => void;
  finish: () => void;
  stop: () => void;
};

let speechGeneration = 0;
let activeAudio: HTMLAudioElement | null = null;
let audioUrl: string | null = null;
let cancelPlayback: (() => void) | null = null;
let cancelSpeechStream: (() => void) | null = null;
let activeSpeechStream: NearSpeechStream | null = null;
let synthesisQueue: Promise<unknown> = Promise.resolve();
// Replay common greetings/readings without generating them again. Memory only,
// bounded to 24 chunks / 12 MiB, and released when the app closes.
const audioCache = new Map<string, Blob>();
let cachedBytes = 0;

function requestAudio(text: string, voice: string, generation: number): Promise<Blob | null> {
  const request = synthesisQueue.then(async () => {
    if (generation !== speechGeneration) return null;
    const key = `${voice}\0${text}`;
    const cached = audioCache.get(key);
    if (cached) {
      audioCache.delete(key);
      audioCache.set(key, cached);
      return cached;
    }
    const encoded = await invoke<string>("synthesize_near_voice", { voiceId: voice, text });
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    const blob = new Blob([bytes], { type: "audio/wav" });
    audioCache.set(key, blob);
    cachedBytes += blob.size;
    while (audioCache.size > 24 || cachedBytes > 12 * 1024 * 1024) {
      const oldest = audioCache.entries().next().value!;
      cachedBytes -= oldest[1].size;
      audioCache.delete(oldest[0]);
    }
    return generation === speechGeneration ? blob : null;
  });
  // Serialize requests so canceled utterances cannot leave a backlog in Rust.
  synthesisQueue = request.catch(() => {});
  return request;
}

function releaseAudio(): void {
  if (activeAudio) {
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.onplaying = null;
    activeAudio.pause();
    activeAudio.removeAttribute("src");
    activeAudio.load();
    activeAudio = null;
  }
  if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
}

function playChunk(blob: Blob, rate: number, onStart: () => void, onProgress?: (progress: number) => void): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let progressFrame = 0;
    let audio: HTMLAudioElement;
    const finish = (played: boolean, error?: unknown) => {
      if (settled) return;
      settled = true;
      window.cancelAnimationFrame(progressFrame);
      cancelPlayback = null;
      releaseAudio();
      if (error !== undefined) reject(error);
      else resolve(played);
    };
    audioUrl = URL.createObjectURL(blob);
    audio = new Audio(audioUrl);
    audio.preservesPitch = true;
    audio.playbackRate = rate;
    activeAudio = audio;
    cancelPlayback = () => finish(false);
    const reportProgress = () => {
      if (settled) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        onProgress?.(Math.min(1, audio.currentTime / audio.duration));
      }
      progressFrame = window.requestAnimationFrame(reportProgress);
    };
    audio.onplaying = () => {
      onStart();
      onProgress?.(0);
      progressFrame = window.requestAnimationFrame(reportProgress);
    };
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false, "NEAR couldn't play this voice. Try again.");
    void audio.play().catch((cause) => finish(false, cause));
  });
}

async function speakPiper(text: string, voice: string, rate: number, generation: number, handle: NearSpeech): Promise<void> {
  const chunks = splitSpeechText(text);
  // Capture prefetch failures immediately, even while another chunk is playing.
  const prepare = (chunk: string) => requestAudio(chunk, voice, generation).then(
    (blob) => ({ blob, error: null }),
    (cause: unknown) => ({ blob: null, error: String(cause) }),
  );
  let pending = prepare(chunks[0]);
  let started = false;
  try {
    for (let index = 0; index < chunks.length; index += 1) {
      const result = await pending;
      if (generation !== speechGeneration) return;
      if (result.error !== null) throw new Error(result.error);
      if (!result.blob) return;
      const playing = playChunk(result.blob, rate, () => {
        if (generation !== speechGeneration || started) return;
        started = true;
        handle.onstart?.();
      });
      // Only prepare one chunk ahead, while the current chunk is audible.
      if (index + 1 < chunks.length) pending = prepare(chunks[index + 1]);
      if (!await playing || generation !== speechGeneration) return;
    }
    handle.onend?.();
  } catch (cause) {
    if (generation !== speechGeneration) return;
    stopNearVoice();
    handle.onerror?.(String(cause));
  }
}

function speakBrowserChunk(text: string, voiceName: string, rate: number, generation: number, handle: NearSpeech): Promise<void> {
  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    utterance.voice = voices.find((voice) => voiceId(voice) === voiceName)
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("en") && voice.default)
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("en"))
      ?? null;
    utterance.lang = utterance.voice?.lang ?? "en-US";
    utterance.rate = 1.04 * rate;
    utterance.pitch = 1;
    utterance.onstart = () => { if (generation === speechGeneration) handle.onstart?.(); };
    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      if (generation === speechGeneration && event.error !== "canceled") reject(`Voice playback failed: ${event.error}`);
      else resolve();
    };
    synth.speak(utterance);
  });
}

export function startNearSpeechStream(
  preferredVoice = localStorage.getItem(NEAR_VOICE_KEY) ?? "",
  options: { rate?: number } = {},
): NearSpeechStream {
  stopNearVoice();
  const generation = speechGeneration;
  const rate = Number.isFinite(options.rate) ? Math.max(0.75, Math.min(1.5, options.rate!)) : 1.0;
  const handle: NearSpeechStream = {
    status: "queued",
    errorMessage: null,
    onstart: null,
    onend: null,
    onerror: null,
    push: () => {},
    finish: () => {},
    stop: () => {},
    onCaptionProgress: null,
  };
  activeSpeechStream = handle;
  const queue: string[] = [];
  let waiting: ((chunk: string | null) => void) | null = null;
  let pending = "";
  let closed = false;
  let started = false;
  let queuedFirstChunk = false;
  let firstChunkTimer: number | undefined;
  const clearFirstChunkTimer = () => {
    if (firstChunkTimer !== undefined) window.clearTimeout(firstChunkTimer);
    firstChunkTimer = undefined;
  };
  const take = () => queue.length
    ? Promise.resolve(queue.shift()!)
    : closed ? Promise.resolve(null) : new Promise<string | null>((resolve) => { waiting = resolve; });
  const enqueue = (chunk: string) => {
    const value = cleanSpeechText(chunk);
    if (!value) return;
    clearFirstChunkTimer();
    queuedFirstChunk = true;
    if (waiting) { const resolve = waiting; waiting = null; resolve(value); }
    else queue.push(value);
  };
  const close = () => {
    if (closed) return;
    clearFirstChunkTimer();
    closed = true;
    waiting?.(null);
    waiting = null;
  };
  const markStart = () => {
    if (started) return;
    started = true;
    handle.status = "speaking";
    handle.onstart?.();
  };
  const drain = (final = false) => {
    let end: number;
    while ((end = speechChunkEnd(pending, queuedFirstChunk ? 240 : 120, final))) {
      enqueue(pending.slice(0, end));
      pending = pending.slice(end).trimStart();
    }
  };
  handle.push = (delta) => {
    if (closed || generation !== speechGeneration) return;
    pending += delta;
    drain();
    if (!queuedFirstChunk && firstChunkTimer === undefined && pending.trim()) {
      // Do not wait indefinitely for punctuation, 120 characters, or the
      // server's completion event. Only speak text ending at a whole word.
      firstChunkTimer = window.setTimeout(() => {
        firstChunkTimer = undefined;
        if (closed || generation !== speechGeneration || queuedFirstChunk) return;
        const completeSentence = /\p{L}[.!?]["'”’)}\]]*\s*$/u.test(pending);
        const end = completeSentence ? pending.length : pending.search(/\s+\S*$/u);
        if (end > 0 && (completeSentence || cleanSpeechText(pending.slice(0, end)).length >= 24)) {
          enqueue(pending.slice(0, end));
          pending = pending.slice(end).trimStart();
        }
      }, 500);
    }
  };
  handle.finish = () => {
    if (closed || generation !== speechGeneration) return;
    drain(true);
    close();
  };
  handle.stop = () => stopNearVoice();
  cancelSpeechStream = close;
  void (async () => {
    try {
      if (preferredVoice.startsWith("piper:")) {
        let chunk = await take();
        let audio = chunk === null ? null : await requestAudio(chunk, preferredVoice, generation);
        while (audio && generation === speechGeneration) {
          const caption = chunk!;
          const upcomingAudio = take()
            .then(async (nextText) => nextText === null ? null : ({ text: nextText, audio: await requestAudio(nextText, preferredVoice, generation) }))
            .then((next) => ({ next, error: null as unknown }), (error: unknown) => ({ next: null, error }));
          handle.onCaptionProgress?.(caption, 0);
          if (!await playChunk(audio, rate, markStart, (progress) => handle.onCaptionProgress?.(caption, progress))) break;
          const upcoming = await upcomingAudio;
          if (upcoming.error) throw upcoming.error;
          chunk = upcoming.next?.text ?? null;
          audio = upcoming.next?.audio ?? null;
        }
      } else {
        while (generation === speechGeneration) {
          const chunk = await take();
          if (chunk === null || generation !== speechGeneration) break;
          handle.onCaptionProgress?.(chunk, 1);
          await speakBrowserChunk(chunk, preferredVoice, rate, generation, { ...handle, onstart: markStart });
        }
      }
      if (generation === speechGeneration && closed) {
        handle.status = "finished";
        activeSpeechStream = null;
        cancelSpeechStream = null;
        handle.onend?.();
      }
    } catch (cause) {
      if (generation !== speechGeneration) return;
      handle.status = "error";
      handle.errorMessage = String(cause);
      activeSpeechStream = null;
      close();
      cancelSpeechStream = null;
      handle.onerror?.(String(cause));
    }
  })();
  return handle;
}

export function voiceId(voice: SpeechSynthesisVoice): string {
  return `${voice.name}::${voice.lang}`;
}

export function listSpeechVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices().slice().sort((a, b) => {
    const aEnglish = a.lang.toLowerCase().startsWith("en") ? 0 : 1;
    const bEnglish = b.lang.toLowerCase().startsWith("en") ? 0 : 1;
    return aEnglish - bEnglish || a.name.localeCompare(b.name);
  });
}

export function speakNear(text: string, preferredVoice = localStorage.getItem(NEAR_VOICE_KEY) ?? "", options: { rate?: number } = {}): NearSpeech | null {
  if (!text.trim()) return null;
  const rate = Number.isFinite(options.rate) ? Math.max(0.75, Math.min(1.5, options.rate!)) : 1.1;
  stopNearVoice();
  const generation = speechGeneration;
  const handle: NearSpeech = { onstart: null, onend: null, onerror: null };
  if (preferredVoice.startsWith("piper:")) {
    void speakPiper(text, preferredVoice, rate, generation, handle);
    return handle;
  }
  if (!("speechSynthesis" in window)) return null;
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices();
  utterance.voice = voices.find((voice) => voiceId(voice) === preferredVoice)
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("en") && voice.default)
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("en"))
    ?? null;
  utterance.lang = utterance.voice?.lang ?? "en-US";
  utterance.rate = 1.04 * rate;
  utterance.pitch = 1;
  utterance.onstart = () => { if (generation === speechGeneration) handle.onstart?.(); };
  utterance.onend = () => { if (generation === speechGeneration) handle.onend?.(); };
  utterance.onerror = (event) => { if (generation === speechGeneration) handle.onerror?.(`Voice playback failed: ${event.error}`); };
  synth.speak(utterance);
  return handle;
}

export function stopNearVoice(): void {
  speechGeneration += 1;
  if (activeSpeechStream) activeSpeechStream.status = "stopped";
  activeSpeechStream = null;
  cancelSpeechStream?.();
  cancelSpeechStream = null;
  cancelPlayback?.();
  releaseAudio();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
