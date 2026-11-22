import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";
import { ConversationPanel } from "../conversation/ConversationPanel";

type SignInExpiredPageProps = { onReconnect: () => void; onBasicMode: () => void; onHome: () => void };

export function SignInExpiredPage({ onReconnect, onBasicMode, onHome }: SignInExpiredPageProps) {
  return <ConversationPanel icon="disconnected" title="Reconnect ChatGPT" description="Sign in with your ChatGPT account to continue. Your draft is kept." onHome={onHome}>
    <div className="flex flex-col items-stretch gap-1.5">
      <button className={buttonPrimary} onClick={onReconnect}>⟳ &nbsp; Reconnect</button>
      <button className={buttonSecondary} onClick={onBasicMode}>↪ &nbsp; Use basic mode</button>
    </div>
  </ConversationPanel>;
}
