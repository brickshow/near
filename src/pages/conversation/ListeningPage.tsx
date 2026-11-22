import { useEffect, useRef, useState } from "react";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";
import { localTranscription, type TranscriptionModel, type TranscriptionSession } from "../../lib/transcription";
import { prepareNearVoice, startNearSpeechStream, stopNearVoice, type NearSpeechStream } from "../../lib/voice";
import { prepareChat } from "../../lib/chat";
import { ConversationPanel } from "./ConversationPanel";
import { VoiceWaveform } from "./VoiceWaveform";

type VoicePhase = "checking" | "needs-model" | "downloading" | "ready" | "loading" | "listening" | "processing" | "review" | "sending" | "speaking" | "error";
type ListeningPageProps = {
  onSend: (message: string, onDelta: (delta: string) => void) => Promise<string>;
  onComplete: (transcript: string, reply: string, speech: NearSpeechStream) => void;
  onHome: () => void;
};

export function ListeningPage({ onSend, onComplete, onHome }: ListeningPageProps) {
  const sessionRef = useRef<TranscriptionSession | null>(null);
  const draftRef = useRef("");
  const draftPrefixRef = useRef("");
  const pushToTalkHeldRef = useRef(false);
  const stoppingRef = useRef(false);
  const sendingRef = useRef(false);
  const captureGeneration = useRef(0);
  const downloadInProgressRef = useRef(false);
  const downloadCancelledRef = useRef(false);
  const [phase, setPhase] = useState<VoicePhase>("checking");
  const [model, setModel] = useState<TranscriptionModel | null>(null);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [spokenSubtitle, setSpokenSubtitle] = useState("");

  const updateDraft = (value: string) => {
    draftRef.current = value;
    setDraft(value);
  };

  const refreshModel = async () => {
    const status = await localTranscription.modelStatus();
    setModel(status);
    setPhase(status.installed ? "ready" : "needs-model");
  };

  useEffect(() => {
    let active = true;
    // Start connection/model lookup and voice loading before the user sends.
    // Preparation is optional; a real request reports any failure normally.
    void prepareChat().catch(() => {});
    void prepareNearVoice().catch(() => {});
    void localTranscription.modelStatus().then((status) => {
      if (!active) return;
      setModel(status);
      setPhase(status.installed ? "ready" : "needs-model");
      if (status.installed) {
        void localTranscription.prepare().catch((cause) => {
          if (!active) return;
          setError(`Could not prepare the local speech model: ${String(cause)}`);
          setPhase("error");
        });
      }
    }).catch((cause) => {
      if (!active) return;
      setError(`Could not check the local speech model: ${String(cause)}`);
      setPhase("error");
    });
    return () => {
      active = false;
      captureGeneration.current += 1;
      sessionRef.current?.cancel();
      sessionRef.current = null;
      if (downloadInProgressRef.current) void localTranscription.cancelDownload();
      stopNearVoice();
    };
  }, []);

  const downloadModel = async () => {
    downloadCancelledRef.current = false;
    downloadInProgressRef.current = true;
    setDownloadedBytes(0);
    setDownloadTotal(model?.sizeBytes ?? 32_200_000);
    setError("");
    setPhase("downloading");
    try {
      await localTranscription.download(({ downloadedBytes: downloaded, totalBytes: total }) => {
        setDownloadedBytes(downloaded);
        setDownloadTotal(total);
      });
      await refreshModel();
    } catch (cause) {
      if (downloadCancelledRef.current) {
        setPhase("needs-model");
      } else {
        setError(String(cause));
        setPhase("error");
      }
    } finally {
      downloadInProgressRef.current = false;
    }
  };

  const cancelDownload = async () => {
    downloadCancelledRef.current = true;
    await localTranscription.cancelDownload();
  };

  const startRecording = async () => {
    if (!model?.installed || phase === "loading" || phase === "listening" || phase === "processing") return;
    setError("");
    setPhase("loading");
    const generation = ++captureGeneration.current;
    try {
      // Load and warm Whisper before capturing audio so model startup does not
      // consume the small processing headroom while the user is speaking.
      await localTranscription.prepare();
      if (generation !== captureGeneration.current) return;
      if (!pushToTalkHeldRef.current) {
        setPhase("ready");
        return;
      }
      const prefix = draftRef.current.trim();
      draftPrefixRef.current = prefix;
      const session = await localTranscription.start(
        (partial) => {
          const nextDraft = [prefix, partial].filter(Boolean).join(" ");
          console.info("[NEAR voice] Transcribed speech:", partial);
          draftRef.current = nextDraft;
          setDraft(nextDraft);
        },
        (cause) => {
          console.error("[NEAR voice] Transcription failed:", cause);
          setError(`Transcription stopped: ${cause.message}`);
          setPhase("error");
          sessionRef.current?.cancel();
          sessionRef.current = null;
        },
      );
      if (generation !== captureGeneration.current) { session.cancel(); return; }
      sessionRef.current = session;
      stoppingRef.current = false;
      setPhase("listening");
      // Key-up may happen while microphone permission/startup is still pending.
      if (!pushToTalkHeldRef.current) void stopRecording(true);
    } catch (cause) {
      sessionRef.current?.cancel();
      sessionRef.current = null;
      setError(cause instanceof Error ? cause.message : `Could not start transcription: ${String(cause)}`);
      setPhase("error");
    }
  };

  const stopRecording = async (sendAfterStop = false) => {
    const session = sessionRef.current;
    if (!session || stoppingRef.current) return;
    stoppingRef.current = true;
    setPhase("processing");
    try {
      const finalText = await session.stop();
      if (sessionRef.current !== session) return;
      console.info("[NEAR voice] Final transcript:", finalText || "(empty)");
      if (!finalText.trim()) {
        sessionRef.current = null;
        stoppingRef.current = false;
        setError("No speech was recognized. Hold N and try again.");
        setPhase("error");
        return;
      }
      if (finalText) {
        const finalDraft = [draftPrefixRef.current, finalText].filter(Boolean).join(" ");
        updateDraft(finalDraft);
      }
      sessionRef.current = null;
      stoppingRef.current = false;
      if (!draftRef.current.trim()) {
        setError("No speech was recognized. Hold N and speak a little longer.");
        setPhase("error");
      } else {
        setError("");
        if (sendAfterStop) {
          setPhase("review");
          void sendDraft();
        } else {
          setPhase("review");
        }
      }
    } catch (cause) {
      sessionRef.current = null;
      stoppingRef.current = false;
      setError(cause instanceof Error ? cause.message : `Transcription failed: ${String(cause)}`);
      setPhase("error");
    }
  };

  const beginPushToTalk = () => {
    if (pushToTalkHeldRef.current) return;
    if (phase !== "ready" && phase !== "review" && phase !== "error") return;
    pushToTalkHeldRef.current = true;
    if (!model?.installed) {
      setError("Download the local speech model before using push-to-talk.");
      setPhase("error");
      pushToTalkHeldRef.current = false;
      return;
    }
    void startRecording();
  };

  const endPushToTalk = () => {
    if (!pushToTalkHeldRef.current) return;
    pushToTalkHeldRef.current = false;
    if (sessionRef.current) void stopRecording(true);
  };

  const cancelRecording = () => {
    captureGeneration.current += 1;
    pushToTalkHeldRef.current = false;
    sessionRef.current?.cancel();
    sessionRef.current = null;
    stoppingRef.current = false;
    updateDraft(draftPrefixRef.current);
    setPhase(draftRef.current ? "review" : "ready");
  };

  const sendDraft = async () => {
    const approvedText = draftRef.current.trim();
    if (!approvedText || sendingRef.current) return;
    console.info("[NEAR voice] Sending transcript to NEAR:", approvedText);
    sendingRef.current = true;
    setError("");
    setSpokenSubtitle("");
    setPhase("sending");
    const speech = startNearSpeechStream();
    speech.onstart = () => setPhase("speaking");
    speech.onCaptionProgress = (sentence, progress) => {
      const characters = Array.from(sentence);
      const visibleText = characters.slice(0, Math.ceil(characters.length * progress)).join("");
      setSpokenSubtitle(visibleText.trim().split(/\s+/u).slice(-5).join(" "));
    };
    speech.onend = () => setPhase("ready");
    speech.onerror = (cause) => {
      setError(cause);
      setPhase("error");
    };
    try {
      const reply = await onSend(approvedText, (delta) => {
        speech.push(delta);
      });
      speech.finish();
      updateDraft("");
      onComplete(approvedText, reply, speech);
    } catch (cause) {
      speech.onstart = null;
      speech.onend = null;
      speech.stop();
      setError(`NEAR could not respond. Your transcript is still here. ${String(cause)}`);
      setPhase("error");
    } finally {
      sendingRef.current = false;
    }
  };

  const leave = () => {
    captureGeneration.current += 1;
    pushToTalkHeldRef.current = false;
    sessionRef.current?.cancel();
    sessionRef.current = null;
    stopNearVoice();
    onHome();
  };

  useEffect(() => {
    const isEditable = (target: EventTarget | null) => target instanceof HTMLElement
      && (target.isContentEditable || target.closest("input, textarea, [contenteditable='true']") !== null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (phase === "listening" || phase === "processing")) {
        cancelRecording();
        return;
      }
      if (event.key.toLowerCase() !== "n" || event.repeat || event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target)) return;
      event.preventDefault();
      beginPushToTalk();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "n") endPushToTalk();
    };
    const onBlur = () => endPushToTalk();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [model?.installed, phase]);

  const percent = downloadTotal > 0 ? Math.min(100, Math.floor(downloadedBytes / downloadTotal * 100)) : 0;

  const animationMode = phase === "listening" ? "recording" : phase === "processing" || phase === "sending" ? "analyzing" : phase === "speaking" ? "speaking" : "ready";
  const statusText = phase === "ready" || phase === "review"
    ? "Hold N to speak"
    : phase === "listening"
      ? "Listening · release N to send · Esc to cancel"
      : phase === "sending"
        ? "NEAR is typing…"
      : phase === "processing"
        ? "NEAR is analyzing"
        : phase === "speaking"
          ? "NEAR is speaking"
        : phase === "loading"
          ? "Starting voice..."
          : phase === "downloading"
            ? `Downloading Whisper · ${percent}%`
            : phase === "needs-model"
              ? "Download speech recognition (Whisper)"
              : phase === "checking"
                ? "Getting NEAR ready..."
                : "Voice is unavailable · Hold N to retry";

  return <ConversationPanel title="" description="" onHome={leave} hideText hideIcon showNavigation={false}>
    <div className="flex w-full min-w-0 flex-col items-center justify-center gap-1 px-4 py-0 text-center">
      <button type="button" className={`${buttonSecondary} !h-[24px] !min-w-0 !self-start !px-2 text-[9px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e4ef]`} onClick={leave}>
        <BackIcon />Back to Home
      </button>
      <div className="-my-1"><VoiceWaveform mode={animationMode} /></div>
      {phase === "speaking" ? <>
        <p className="m-0 min-h-[2.4em] max-h-[3em] w-full overflow-hidden text-center text-[11px] leading-[1.2] text-[#e3ebf1]" aria-live="off">{spokenSubtitle}</p>
        <span className="sr-only" role="status" aria-live="polite">NEAR is speaking</span>
      </> : <p className="m-0 text-[11px] font-medium text-[#e3ebf1]" role="status" aria-live="polite">{statusText}</p>}
      {(phase === "needs-model" || (phase === "error" && !model?.installed)) && <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-2">
        <span className="text-[9px] text-[#c6d2de]">Whisper listens to you · separate from Bryce · about 32 MB</span>
        <button type="button" className={`${buttonPrimary} !h-[25px] !min-w-0 !px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e4ef]`} onClick={() => void downloadModel()}>Download Whisper</button>
      </div>}
      {phase === "downloading" && <div className="flex w-full items-center gap-3 px-2">
        <progress className="h-1.5 min-w-0 flex-1 accent-[#49dceb]" value={downloadedBytes} max={downloadTotal || model?.sizeBytes || 32_200_000} aria-label={`Downloading Whisper speech recognition model, ${percent}%`} />
        <button type="button" className={`${buttonSecondary} !h-[25px] !min-w-0 !px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e4ef]`} onClick={() => void cancelDownload()}>Cancel</button>
      </div>}
      {phase === "error" && <p className="m-0 max-h-7 overflow-y-auto text-[9px] text-[#ff9c8f]" role="alert">{error || "Something went wrong. Hold N to try again."}</p>}
      {phase === "listening" && <p className="sr-only" aria-live="polite">{draft || "Listening. Release N to send."}</p>}
    </div>
  </ConversationPanel>;
}

function BackIcon() { return <svg className="h-3 w-3 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3 2.5 8 7 13M3 8h10" /></svg>; }

