import type { AgentChoice } from "../choose-agent/ChooseAgentPage";
import { OnboardingPanel } from "../../components/OnboardingPanel";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";

type AgentFoundPageProps = { agent: AgentChoice; onConnect: () => void; onChooseAnother: () => void; busy?: boolean; message?: string };

export function AgentFoundPage({ agent, onConnect, onChooseAnother, busy = false, message }: AgentFoundPageProps) {
  return <OnboardingPanel icon="success" title={`${agent} found`} description={message || "Ready to connect on this computer."}>
    <button className={buttonPrimary} onClick={onConnect} disabled={busy}>{busy ? "Waiting for ChatGPT…" : `Connect ${agent}`}</button>
    <button className={buttonSecondary} onClick={onChooseAnother}>Choose another</button>
  </OnboardingPanel>;
}
