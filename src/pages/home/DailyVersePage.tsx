import { OnboardingPanel } from "../../components/OnboardingPanel";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";
import { findBibleReferences } from "../../lib/bibleReferences";
import { useDailyVerse } from "./dailyVerse";

type DailyVersePageProps = { onRead: () => void; onLater: () => void; onReflect: (passage: { book: number; chapter: number; verse: number; endVerse?: number } | undefined) => void };

export function DailyVersePage({ onRead, onLater, onReflect }: DailyVersePageProps) {
  const dailyVerse = useDailyVerse();
  const reference = findBibleReferences(dailyVerse.reference)[0]?.passage;
  return <OnboardingPanel icon="book" title="A quiet moment" description={`“${dailyVerse.text}”  ${dailyVerse.reference} · ${dailyVerse.translation}`}>
    <button className={buttonPrimary} onClick={onRead}>Read</button>
    <button className={buttonSecondary} onClick={() => onReflect(reference)}>Reflect</button>
    <button className={buttonSecondary} onClick={onLater}>Later</button>
  </OnboardingPanel>;
}
