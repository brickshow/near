import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";
import { ConversationPanel } from "../conversation/ConversationPanel";

type PartialSuccessPageProps = { onRetry: () => void; onViewReminder: () => void; onHome: () => void };

export function PartialSuccessPage({ onRetry, onViewReminder, onHome }: PartialSuccessPageProps) {
  return <ConversationPanel icon="success" title="One thing needs attention" onHome={onHome}>
    <div className="flex flex-col gap-1.5">
      <p className="m-0 flex items-center gap-2 text-[10px] text-[#d8e2e9]"><span className="grid h-4 w-4 place-items-center rounded-full bg-[#40d9ae] text-[9px] text-[#052a22]">✓</span>Prayer reminder saved</p>
      <p className="m-0 flex items-center gap-2 text-[10px] text-[#d8e2e9]"><span className="text-[14px] text-[#ffbd39]">⚠</span>Music could not start</p>
      <div className="flex justify-end gap-1.5">
        <button className={buttonPrimary} onClick={onRetry}>⟳ &nbsp; Retry music</button>
        <button className={buttonSecondary} onClick={onViewReminder}>▤ &nbsp; View reminder</button>
      </div>
    </div>
  </ConversationPanel>;
}
