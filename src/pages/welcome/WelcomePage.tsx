import { OnboardingPanel } from "../../components/OnboardingPanel";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";

type WelcomePageProps = { onGetStarted: () => void; onExplore: () => void };

export function WelcomePage({ onGetStarted, onExplore }: WelcomePageProps) {
  return <OnboardingPanel icon="orb" title="Welcome to NEAR" description="Your quiet companion, close by.">
    <button className={buttonPrimary} onClick={onGetStarted}>Get started</button>
    <button className={buttonSecondary} onClick={onExplore}>Explore without AI</button>
  </OnboardingPanel>;
}
