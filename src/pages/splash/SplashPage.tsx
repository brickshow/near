import { useEffect, useState } from "react";
import { speakNear, stopNearVoice } from "../../lib/voice";
import { BibleOpening } from "./BibleOpening";

const INTRO = "Hello, Brix. I'm NEAR. I'm here to help you stay close to God through prayer and Scripture.";

type SplashPageProps = { intro?: boolean; voiceName?: string; onComplete?: () => void };

export function SplashPage({ intro = false, voiceName = "", onComplete }: SplashPageProps) {
  const [playback, setPlayback] = useState<"preparing" | "speaking" | "finished" | "error">("preparing");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!intro || !onComplete) return;
    let disposed = false;
    let completeTimer: number | undefined;
    setPlayback("preparing");
    const speech = speakNear(INTRO, voiceName, { rate: 1.1 });
    if (speech) {
      speech.onstart = () => { if (!disposed) setPlayback("speaking"); };
      speech.onend = () => {
        if (disposed) return;
        setPlayback("finished");
        // Let playback finish, including any time spent generating the local WAV.
        completeTimer = window.setTimeout(() => { if (!disposed) onComplete(); }, 650);
      };
      speech.onerror = () => {
        if (!disposed) setPlayback("error");
      };
    } else {
      setPlayback("error");
    }
    return () => { disposed = true; window.clearTimeout(completeTimer); stopNearVoice(); };
  }, [intro, voiceName, onComplete, attempt]);

  return <section className="relative z-[1] flex h-full w-full flex-col items-center justify-center overflow-hidden" aria-label={intro ? "NEAR's introduction" : "NEAR is starting"}>
    <BibleOpening speaking={intro && playback === "speaking"} compact={intro && playback === "error"} />
    <div className="bible-splash-copy mt-[-3px] text-center">
      <h1 className="m-0 text-[17px] font-semibold tracking-[-.02em] text-[#eafaff]">{intro ? "Hello, Brix." : "NEAR"}</h1>
      {intro && playback === "error" ? <div>
        <p role="alert" className="mb-1 mt-1 text-[10px] text-[#c0d5df]">The introduction couldn't play.</p>
        <div className="flex justify-center gap-3 text-[10px] text-[#91e8ef]">
          <button type="button" className="cursor-pointer rounded px-2 py-1 hover:bg-white/10" onClick={() => setAttempt((value) => value + 1)}>Retry audio</button>
          <button type="button" className="cursor-pointer rounded px-2 py-1 hover:bg-white/10" onClick={onComplete}>Go to Home</button>
        </div>
      </div> : <p className="mb-0 mt-1 max-w-[330px] text-[10px] leading-[1.35] text-[#c0d5df]">{intro ? "I'm here to help you stay close to God through prayer and Scripture." : "A little light for your walk with God."}</p>}
      {intro ? <span role="status" className="sr-only">{playback === "preparing" ? "Preparing NEAR's welcome." : playback === "speaking" ? "NEAR is speaking." : playback === "finished" ? "Welcome complete." : "Audio unavailable."}</span> : null}
    </div>
  </section>;
}
