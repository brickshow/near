import { OnboardingPanel } from "../../components/OnboardingPanel";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";

export type AgentChoice = "ChatGPT" | "Claude Code" | "Local model";
type ChooseAgentPageProps = {
  agent: AgentChoice;
  onAgentChange: (agent: AgentChoice) => void;
  onLater: () => void;
  onContinue: () => void;
  error?: string;
};
const AGENTS: AgentChoice[] = ["ChatGPT", "Claude Code", "Local model"];

export function ChooseAgentPage({ agent, onAgentChange, onLater, onContinue, error }: ChooseAgentPageProps) {
  return <OnboardingPanel icon="robot" title="Choose your AI" description="Sign in with your own ChatGPT account. Using its plan in NEAR requires an eligible plan.">
    <div className="flex w-full gap-[5px]" role="group" aria-label="Choose an agent">
      {AGENTS.map((choice) => {
        const available = choice === "ChatGPT";
        return <button key={choice} disabled={!available} title={available ? undefined : "Coming soon"} aria-label={available ? choice : `${choice}, coming soon`} className={`inline-flex h-[29px] min-w-0 flex-1 items-center justify-center gap-[7px] whitespace-nowrap rounded-[7px] border px-[7px] text-[10px] ${available ? "cursor-pointer" : "cursor-not-allowed opacity-50"} ${choice === agent ? "border-[#1ed9e7] text-[#48deea] shadow-[inset_0_0_0_1px_rgba(30,217,231,0.11)]" : "border-[#7691ad]/[0.22] text-[#d2dce7]"} bg-[#111e2b]/[0.86]`} aria-pressed={choice === agent} onClick={() => { if (available) onAgentChange(choice); }}>
        <AgentIcon agent={choice} />{choice}
      </button>;
      })}
    </div>
    {error && <p role="alert" className="w-full rounded-md border border-[#ff7777]/35 bg-[#ff7777]/10 px-3 py-2 text-left text-[11px] leading-relaxed text-[#ffb4b4]">{error}</p>}
    <div className="flex w-full items-center gap-2">
      <span className="flex-1" />
      <button className={`${buttonSecondary} min-w-[87px]`} onClick={onLater}>Later</button>
      <button className={buttonPrimary} onClick={onContinue}>Continue</button>
    </div>
  </OnboardingPanel>;
}

function AgentIcon({ agent }: { agent: AgentChoice }) {
  const className = "h-4 w-4 shrink-0 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.35]";
  if (agent === "ChatGPT") return <svg className={className} viewBox="0 0 18 18" aria-hidden="true"><path d="m9 1.7 6.1 3.6v7.3L9 16.2l-6.1-3.6V5.3L9 1.7Z"/><path d="m2.9 5.3 6.1 3.6 6.1-3.6M9 8.9v7.3"/></svg>;
  if (agent === "Claude Code") return <svg className={className} viewBox="0 0 18 18" aria-hidden="true"><path d="M9 1.7v14.6M3.1 5.1l11.8 7.8M14.9 5.1 3.1 12.9M4.8 2.7l8.4 12.6M13.2 2.7 4.8 15.3"/></svg>;
  return <svg className={className} viewBox="0 0 18 18" aria-hidden="true"><path d="M2 3h14v10H2zM6 16h6m-3-3v3"/></svg>;
}
