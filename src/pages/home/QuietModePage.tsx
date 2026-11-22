import { OnboardingPanel } from "../../components/OnboardingPanel";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";

type QuietModePageProps = { onResume: () => void; onAdjust: () => void; onChangeVoice: () => void };

export function QuietModePage({ onResume, onAdjust, onChangeVoice }: QuietModePageProps) {
  return <OnboardingPanel icon="quiet" title="Quiet mode is on" description="Until 6:00 PM. Scheduled reminders remain in your list.">
    <button className={buttonPrimary} onClick={onResume}>▶ &nbsp; Resume</button>
    <button className={buttonSecondary} onClick={onAdjust}>⚙ &nbsp; Adjust quiet hours</button>
    <button className={buttonSecondary} onClick={onChangeVoice}>Change NEAR voice</button>
  </OnboardingPanel>;
}
