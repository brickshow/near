import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";
import { ConversationPanel } from "../conversation/ConversationPanel";

type UsageLimitPageProps = { onSwitchAgent: () => void; onHome: () => void };

export function UsageLimitPage({ onSwitchAgent, onHome }: UsageLimitPageProps) {
  return <ConversationPanel icon="limit" title="Your agent reached its limit" description="Try later or choose another connected agent." onHome={onHome}>
    <div className="flex flex-col items-stretch gap-1.5">
      <button className={buttonPrimary} onClick={onSwitchAgent}>♙ &nbsp; Switch agent</button>
      <button className={buttonSecondary} onClick={onHome}>⌂ &nbsp; Back to Home</button>
    </div>
  </ConversationPanel>;
}
