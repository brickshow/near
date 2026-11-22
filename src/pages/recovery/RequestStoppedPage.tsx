import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";
import { ConversationPanel } from "../conversation/ConversationPanel";

type RequestStoppedPageProps = { onViewReminder: () => void; onUndo: () => void; onDone: () => void; onHome: () => void };

export function RequestStoppedPage({ onViewReminder, onUndo, onDone, onHome }: RequestStoppedPageProps) {
  return <ConversationPanel icon="success" title="Stopped" description="The prayer reminder was already saved." onHome={onHome}>
    <div className="flex flex-col items-stretch gap-1.5">
      <button className={buttonPrimary} onClick={onViewReminder}>▤ &nbsp; View reminder</button>
      <button className={buttonSecondary} onClick={onUndo}>↶ &nbsp; Undo reminder</button>
      <button className={buttonSecondary} onClick={onDone}>✓ &nbsp; Done</button>
    </div>
  </ConversationPanel>;
}
