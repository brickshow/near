import { useEffect } from "react";
import { buttonSecondary } from "../../components/buttonClasses";
import { ConversationPanel } from "./ConversationPanel";

type UnderstandingRequestPageProps = { onCancel: () => void; onNext: () => void; onHome: () => void };

export function UnderstandingRequestPage({ onCancel, onNext, onHome }: UnderstandingRequestPageProps) {
  useEffect(() => {
    const timer = window.setTimeout(onNext, 2300);
    return () => window.clearTimeout(timer);
  }, [onNext]);

  return <ConversationPanel title="Working on your request" description="Remind me to pray at nine." onHome={onHome}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5" aria-label="Processing request"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#40dce9]"/><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#40dce9] [animation-delay:150ms]"/><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#40dce9] [animation-delay:300ms]"/></div>
      <button className={buttonSecondary} onClick={onCancel}>Cancel</button>
    </div>
  </ConversationPanel>;
}
