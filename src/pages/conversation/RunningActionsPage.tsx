import { useEffect } from "react";
import { ConversationPanel } from "./ConversationPanel";

type RunningActionsPageProps = { onStop: () => void; onNext: () => void; onHome: () => void };

export function RunningActionsPage({ onStop, onNext, onHome }: RunningActionsPageProps) {
  useEffect(() => {
    const timer = window.setTimeout(onNext, 2400);
    return () => window.clearTimeout(timer);
  }, [onNext]);

  return <ConversationPanel title="Taking care of it" onHome={onHome}>
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex h-[27px] items-center gap-2 rounded-lg bg-white/[0.055] px-2 text-[9px] text-[#d6e1e8]"><span className="text-[#5ce2bd]">✓</span><span className="flex-1">Prayer reminder</span><span className="text-[#9daab7]">Saved</span></div>
        <div className="flex h-[27px] items-center gap-2 rounded-lg bg-white/[0.055] px-2 text-[9px] text-[#d6e1e8]"><span className="h-3 w-3 animate-spin rounded-full border border-[#35d7e7] border-r-transparent"/><span className="flex-1">Music search</span><span className="text-[#54cceb]">Working…</span></div>
      </div>
      <button className="inline-flex h-[30px] min-w-[88px] cursor-pointer items-center justify-center gap-1.5 rounded-[7px] border border-[#ff716c] bg-[#ff716c] px-3 text-[10px] font-semibold text-[#2b1112] hover:bg-[#ff8983]" onClick={onStop}><StopIcon />Stop</button>
    </div>
  </ConversationPanel>;
}

function StopIcon() { return <svg className="h-3 w-3 fill-current" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1" /></svg>; }
