import { MusicPanel } from "./MusicPanel";
import { useEffect, useState } from "react";
import { HomeOrb } from "./HomeOrb";
import { HomeNavigation, type HomeSection } from "../../components/HomeNavigation";
import { findBibleReferences } from "../../lib/bibleReferences";
import { useDailyVerse } from "./dailyVerse";

type DailyPassage = { book: number; chapter: number; verse: number; endVerse?: number };
type HomePageProps = { agent: string; activeTab?: HomeSection; onTabChange?: (tab: HomeSection) => void; onTalk: () => void; onType: () => void; onFaithJourney: () => void; onReviewChange: (passage?: DailyPassage) => void; onNotes: () => void; onChurch: () => void; onSettings?: () => void };

export function HomePage({ agent, activeTab, onTabChange, onTalk, onType, onFaithJourney, onReviewChange, onNotes, onChurch, onSettings = () => {} }: HomePageProps) {
  const [localTab, setLocalTab] = useState<HomeSection>("Home");
  const tab = activeTab ?? localTab;
  const dailyVerse = useDailyVerse();
  const dailyPassage = findBibleReferences(dailyVerse.reference)[0]?.passage;
  const [visibleVerse, setVisibleVerse] = useState("");
  useEffect(() => {
    const text = dailyVerse.text;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceMotion === "true") {
      setVisibleVerse(text);
      return;
    }
    let position = 0;
    const timer = window.setInterval(() => {
      position = Math.min(text.length, position + 2);
      setVisibleVerse(text.slice(0, position));
      if (position === text.length) window.clearInterval(timer);
    }, 24);
    return () => window.clearInterval(timer);
  }, [dailyVerse.text]);

  const navigate = (next: HomeSection) => {
    if (next === "Settings") { onSettings(); return; }
    if (next === "Journey") {
      if (onTabChange) onTabChange(next); else setLocalTab(next);
      onFaithJourney();
      return;
    }
    if (onTabChange) onTabChange(next); else setLocalTab(next);
    if (next === "Bible") onReviewChange();
    if (next === "Notes") onNotes();
    if (next === "Church") onChurch();
  };

  return <section className="home-page">
    {tab === "Music" ? <div className="home-music"><MusicPanel onTalk={onTalk} /></div> : <div className="home-content">
      <div className="home-orb-panel"><HomeOrb /></div>
      <article className="home-verse" aria-label="Daily verse">
        <div className="home-verse-kicker"><SparkIcon /><span>TODAY’S SCRIPTURE</span></div>
        <p className="home-verse-text" tabIndex={0} aria-label={dailyVerse.text}>“{visibleVerse}”</p>
        <div className="home-verse-meta"><span>{dailyVerse.reference} · {dailyVerse.translation}</span><button onClick={() => onReviewChange(dailyPassage)}>Read passage <ExternalIcon /></button></div>
      </article>
      <div className="home-actions">
        <button className="home-talk-button" onClick={onTalk}><MicIcon />Talk to NEAR</button>
        <div className="home-secondary-actions">
          <button onClick={onType}><ChatIcon />Chat</button>
          <button onClick={onFaithJourney}><JourneyIcon />Journey</button>
        </div>
      </div>
    </div>}
    <div className="home-navigation"><HomeNavigation active={tab} onNavigate={navigate} /></div>
    <span className="sr-only">Connected agent: {agent}</span>
  </section>;
}

function MicIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"/></svg>; }
function ChatIcon() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 6h22v16H15l-7 5v-5H5z"/></svg>; }
function JourneyIcon() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27V8m0 9C9 17 6 13 6 7c7 0 10 4 10 10Zm0-2c0-7 4-10 10-10 0 6-3 10-10 10Z"/></svg>; }
function SparkIcon() { return <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 2 17 11l9 3-9 3-3 9-3-9-9-3 9-3 3-9Z"/><path d="m23 1 1.2 3.8L28 6l-3.8 1.2L23 11l-1.2-3.8L18 6l3.8-1.2L23 1Z"/></svg>; }
function ExternalIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6m0-6-9 9"/><path d="M18 13v6H5V6h6"/></svg>; }
