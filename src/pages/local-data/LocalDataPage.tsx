import { OnboardingPanel } from "../../components/OnboardingPanel";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";

type LocalDataPageProps = { onBack: () => void; onContinue: () => void };

export function LocalDataPage({ onBack, onContinue }: LocalDataPageProps) {
  return <OnboardingPanel icon="document" title="Your space, your choice" description="Notes stay on this device. Messages you send to a cloud agent go to that provider.">
    <button className={`${buttonSecondary} min-w-[76px]`} onClick={onBack}>Back</button>
    <button className={buttonPrimary} onClick={onContinue}>Continue</button>
  </OnboardingPanel>;
}
