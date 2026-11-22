import { OnboardingPanel } from "../../components/OnboardingPanel";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";
import { useDailyVerse } from "./dailyVerse";

type DailyVersePageProps = { onRead: () => void; onLater: () => void };

export function DailyVersePage({ onRead, onLater }: DailyVersePageProps) {
  const dailyVerse = useDailyVerse();
  return <OnboardingPanel icon="book" title="A quiet moment" description={`“${dailyVerse.text}”  ${dailyVerse.reference} · ${dailyVerse.translation}`}>
    <button className={buttonPrimary} onClick={onRead}>▤ &nbsp; Read</button>
    <button className={buttonSecondary} onClick={onLater}>◷ &nbsp; Later</button>
  </OnboardingPanel>;
}
