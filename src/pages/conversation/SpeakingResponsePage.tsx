import { useCallback, useEffect, useRef, useState } from "react";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";
import { speakNear, stopNearVoice, type NearSpeechStream } from "../../lib/voice";
import { ConversationPanel } from "./ConversationPanel";
import { VoiceWaveform } from "./VoiceWaveform";

type SpeakingResponsePageProps = { response: string; transcript?: string; voiceName: string; speechStream?: NearSpeechStream | null; hideResponseText?: boolean; onTalkAgain: () => void; onType: () => void; onHome: () => void };

export function SpeakingResponsePage({ response, transcript, voiceName, speechStream, hideResponseText = false, onTalkAgain, onType, onHome }: SpeakingResponsePageProps) {
  const [speaking, setSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const onTalkAgainRef = useRef(onTalkAgain);
  const returnTimerRef = useRef<number | null>(null);

  useEffect(() => { onTalkAgainRef.current = onTalkAgain; }, [onTalkAgain]);

  const speak = useCallback(() => {
    setVoiceError("");
    const utterance = speakNear(response, voiceName);
    if (!utterance) return;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = (message) => { setSpeaking(false); setVoiceError(message); };
    setSpeaking(true);
  }, [response, voiceName]);

  useEffect(() => {
    if (speechStream) {
      setSpeaking(speechStream.status === "queued" || speechStream.status === "speaking");
      setVoiceError(speechStream.status === "error" ? speechStream.errorMessage ?? "Bryce couldn't play NEAR's response." : "");
      const returnToListening = () => {
        if (hideResponseText) returnTimerRef.current = window.setTimeout(() => onTalkAgainRef.current(), 700);
      };
      if (speechStream.status === "finished") returnToListening();
      const previousEnd = speechStream.onend;
      const previousError = speechStream.onerror;
      speechStream.onend = () => { previousEnd?.(); setSpeaking(false); returnToListening(); };
      speechStream.onerror = (message) => { previousError?.(message); setSpeaking(false); setVoiceError(message); };
      return () => {
        if (returnTimerRef.current !== null) window.clearTimeout(returnTimerRef.current);
        speechStream.onend = previousEnd;
        speechStream.onerror = previousError;
        stopNearVoice();
      };
    }
    speak();
    return () => stopNearVoice();
  }, [hideResponseText, speak, speechStream]);

  return <ConversationPanel title={hideResponseText ? "" : "NEAR replied"} onHome={onHome} hideText={hideResponseText} hideIcon={hideResponseText} showNavigation={!hideResponseText}>
    <div className="flex flex-col gap-2">
      {!hideResponseText && transcript && <p className="m-0 truncate text-[9px] text-[#9eafbe]">You: {transcript}</p>}
      {!hideResponseText && <p className="max-h-[58px] overflow-y-auto rounded-lg bg-[#101e2a] px-2.5 py-2 text-[10px] leading-relaxed text-[#e3ebf1]">{response}</p>}
      {hideResponseText && <>
        <VoiceWaveform mode={speaking ? "speaking" : "ready"} />
        <p className="m-0 text-center text-[11px] font-medium text-[#e3ebf1]" role="status" aria-live="polite">{speaking ? "NEAR is speaking" : voiceError ? "Voice playback failed" : "Getting ready to listen"}</p>
      </>}
      {voiceError && <p role="alert" className="m-0 text-[9px] text-[#ff9c8f]">{voiceError}</p>}
      {!hideResponseText && <div className="flex items-center justify-end gap-2">
        <button className={buttonSecondary} onClick={onTalkAgain}><MicIcon />Talk again</button>
        <button className={buttonSecondary} onClick={() => { stopNearVoice(); setSpeaking(false); }} disabled={!speaking}>Stop voice</button>
        <button className={buttonSecondary} onClick={speak}>Replay</button>
        <button className={buttonPrimary} onClick={onType}><KeyboardIcon />Chat with NEAR</button>
      </div>}
    </div>
  </ConversationPanel>;
}

function KeyboardIcon() { return <svg className="h-3 w-3 fill-none stroke-current [stroke-width:1.4]" viewBox="0 0 18 18" aria-hidden="true"><rect x="1.5" y="4" width="15" height="10" rx="1.5"/><path d="M4 7h.1M7 7h.1M10 7h.1M13 7h.1M4 10h.1M7 10h.1M10 10h.1M13 10h.1M6 12h6"/></svg>; }
function MicIcon() { return <svg className="h-3 w-3 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]" viewBox="0 0 18 18" aria-hidden="true"><rect x="6" y="2" width="6" height="10" rx="3"/><path d="M3.5 9a5.5 5.5 0 0 0 11 0M9 14.5V17m-3 0h6"/></svg>; }
