import { invoke } from "@tauri-apps/api/core";

export type TranscriptionModel = {
  installed: boolean;
  modelName: string;
  sizeBytes: number;
};

export type ModelDownloadProgress = {
  downloadedBytes: number;
  totalBytes: number;
};

export type TranscriptionSession = {
  stop: () => Promise<string>;
  cancel: () => void;
};

export type TranscriptUpdate = (text: string) => void;

type AudioChunk = { type: "audio"; samples: Float32Array };
type CaptureFlushed = { type: "flushed" };
type CaptureMessage = AudioChunk | CaptureFlushed;

export const localTranscription = {
  modelStatus: () => invoke<TranscriptionModel>("whisper_model_status"),
  prepare: () => invoke<void>("prepare_whisper_model"),
  cancelDownload: () => invoke<void>("cancel_whisper_model_download"),

  async download(onProgress: (progress: ModelDownloadProgress) => void): Promise<void> {
    const { listen } = await import("@tauri-apps/api/event");
    const unlisten = await listen<ModelDownloadProgress>("near://whisper-download-progress", ({ payload }) => onProgress(payload));
    try {
      await invoke("download_whisper_model");
    } finally {
      unlisten();
    }
  },

  async start(onTranscript: TranscriptUpdate, onError: (error: Error) => void, options: { deviceId?: string; latestChunkOnly?: boolean } = {}): Promise<TranscriptionSession> {
    const stream = await requestMicrophone(options.deviceId);
    let context: AudioContext | undefined;
    try {
      context = new AudioContext({ sampleRate: 16_000 });
      await context.audioWorklet.addModule("/pcm-capture-worklet.js");
    } catch (cause) {
      stream.getTracks().forEach((track) => track.stop());
      if (context) await context.close().catch(() => {});
      throw new Error(`Audio capture is unavailable: ${String(cause)}`);
    }

    let source: MediaStreamAudioSourceNode;
    let capture: AudioWorkletNode;
    let silentOutput: GainNode;
    try {
      source = context.createMediaStreamSource(stream);
      capture = new AudioWorkletNode(context, "near-pcm-capture", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
      });
      silentOutput = context.createGain();
      silentOutput.gain.value = 0;
      source.connect(capture);
      capture.connect(silentOutput);
      silentOutput.connect(context.destination);
      if (context.state === "suspended") await context.resume();
    } catch (cause) {
      stream.getTracks().forEach((track) => track.stop());
      await context.close().catch(() => {});
      throw new Error(`Audio capture is unavailable: ${String(cause)}`);
    }

    let transcript = "";
    let failure: Error | undefined;
    let disposed = false;
    let stopped = false;
    let queue = Promise.resolve();
    let resolveFlushed!: () => void;
    const flushed = new Promise<void>((resolve) => { resolveFlushed = resolve; });

    capture.port.onmessage = ({ data }: MessageEvent<CaptureMessage>) => {
      if (data.type === "flushed") {
        resolveFlushed();
        return;
      }
      queue = queue.then(async () => {
        if (disposed || failure) return;
        const audioBase64 = pcmWindowToWavBase64(data.samples);
        const words = await invoke<string>("transcribe_near_audio", { audioBase64 });
        if (!disposed && words.trim()) {
          transcript = options.latestChunkOnly ? words.trim() : mergeTranscript(transcript, words.trim());
          onTranscript(transcript);
        }
      }).catch((cause: unknown) => {
        failure = cause instanceof Error ? cause : new Error(String(cause));
        onError(failure);
      });
    };

    const release = () => {
      if (disposed) return;
      disposed = true;
      resolveFlushed();
      stream.getTracks().forEach((track) => track.stop());
      source.disconnect();
      capture.disconnect();
      silentOutput.disconnect();
      void context.close();
    };

    return {
      stop: async () => {
        if (disposed) return "";
        if (!stopped) {
          stopped = true;
          capture.port.postMessage("flush");
          await flushed;
          if (disposed) return "";
          stream.getTracks().forEach((track) => track.stop());
          await queue;
          release();
        }
        if (failure) throw failure;
        return transcript;
      },
      cancel: () => {
        if (disposed) return;
        capture.port.postMessage("cancel");
        release();
      },
    };
  },
};

async function requestMicrophone(deviceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone capture is not supported in this app environment.");
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
    });
  } catch (cause) {
    const name = cause instanceof DOMException ? cause.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new Error("Microphone access was denied. Allow microphone access in Windows privacy settings and try again.");
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      throw new Error("No microphone was found. Connect a microphone and try again.");
    }
    if (name === "OverconstrainedError") {
      throw new Error("The selected microphone is unavailable. Choose another microphone and try again.");
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      throw new Error("The microphone is unavailable. Close other apps using it and try again.");
    }
    throw new Error(`Could not start the microphone: ${String(cause)}`);
  }
}

function pcmWindowToWavBase64(samples: Float32Array): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  write(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16_000, true); view.setUint32(28, 32_000, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample * (sample < 0 ? 32768 : 32767), true);
  }
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function mergeTranscript(previous: string, next: string): string {
  if (!previous) return next;
  const oldWords = previous.split(/\s+/u);
  const newWords = next.split(/\s+/u);
  const normalize = (word: string) => word.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const maxOverlap = Math.min(8, oldWords.length, newWords.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    const oldSuffix = oldWords.slice(-overlap).map(normalize).join(" ");
    const newPrefix = newWords.slice(0, overlap).map(normalize).join(" ");
    if (oldSuffix && oldSuffix === newPrefix) {
      return [...oldWords, ...newWords.slice(overlap)].join(" ").trim();
    }
  }
  return `${previous} ${next}`.trim();
}
