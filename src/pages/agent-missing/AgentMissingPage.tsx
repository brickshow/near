import { OnboardingPanel } from "../../components/OnboardingPanel";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";

type AgentMissingPageProps = { onOpenGuide: () => void; onCheckAgain: () => void; onBasicMode: () => void };

export function AgentMissingPage({ onOpenGuide, onCheckAgain, onBasicMode }: AgentMissingPageProps) {
  return <OnboardingPanel icon="warning" title="ChatGPT is not connected" description="Connect your ChatGPT account to continue. NEAR keeps the sign-in on this device.">
    <button className={buttonPrimary} onClick={onOpenGuide}>Open setup guide <ExternalLinkIcon /></button>
    <button className={buttonSecondary} onClick={onCheckAgain}><RefreshIcon /> Check again</button>
    <button className={`${buttonSecondary} min-w-[112px]`} onClick={onBasicMode}>Use basic mode</button>
  </OnboardingPanel>;
}

function ExternalLinkIcon() {
  return <svg className="h-3 w-3 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.6]" viewBox="0 0 16 16" aria-hidden="true"><path d="M9 2h5v5M14 2 7.5 8.5M12 9v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4" /></svg>;
}

function RefreshIcon() {
  return <svg className="h-3 w-3 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.6]" viewBox="0 0 16 16" aria-hidden="true"><path d="M13 5V2.5L10.5 5M13 5H9.5M3 11v2.5L5.5 11M3 11h3.5M3.8 6.3A4.6 4.6 0 0 1 11 3.9M12.2 9.7A4.6 4.6 0 0 1 5 12.1" /></svg>;
}
