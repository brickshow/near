import { OnboardingPanel } from "../../components/OnboardingPanel";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";

type SetupGuidePageProps = { onBack: () => void; onCheckAgain: () => void };

export function SetupGuidePage({ onBack, onCheckAgain }: SetupGuidePageProps) {
  return <OnboardingPanel icon="robot" title="Connect ChatGPT" description="Sign in with ChatGPT in your browser, allow plan usage for NEAR, then return to the app.">
    <button className={`${buttonSecondary} min-w-[76px]`} onClick={onBack}>Back</button>
    <button className={buttonPrimary} onClick={onCheckAgain}>Check again</button>
  </OnboardingPanel>;
}
