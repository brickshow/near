import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";
import { ConversationPanel } from "../conversation/ConversationPanel";

type AgentUnavailablePageProps = { onRetry: () => void; onChooseAgent: () => void; onNotes: () => void; onHome: () => void };

export function AgentUnavailablePage({ onRetry, onChooseAgent, onNotes, onHome }: AgentUnavailablePageProps) {
  return <ConversationPanel icon="disconnected" title="Your agent is unavailable" description="Local notes and reminders still work." onHome={onHome}>
    <div className="flex flex-col items-stretch gap-1.5">
      <button className={buttonPrimary} onClick={onRetry}>⟳ &nbsp; Retry connection</button>
      <button className={buttonSecondary} onClick={onChooseAgent}>♙ &nbsp; Choose agent</button>
      <button className={buttonSecondary} onClick={onNotes}>▤ &nbsp; Open notes</button>
    </div>
  </ConversationPanel>;
}
