import { OnboardingPanel } from "../../components/OnboardingPanel";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";

type SetupGuidePageProps = { onBack: () => void; onCheckAgain: () => void };

export function SetupGuidePage({ onBack, onCheckAgain }: SetupGuidePageProps) {
  return <OnboardingPanel icon="robot" title="Connect ChatGPT" description="Sign in with your own ChatGPT account on OpenAI’s page and allow plan usage for NEAR. Your account is stored securely for your operating system user. NEAR’s local features work without AI.">
    <button className={`${buttonSecondary} min-w-[76px]`} onClick={onBack}>Back</button>
    <button className={buttonPrimary} onClick={onCheckAgain}>Check again</button>
  </OnboardingPanel>;
}
