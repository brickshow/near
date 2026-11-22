import { MusicPanel } from "./MusicPanel";
import { useEffect, useState } from "react";
import { HomeOrb } from "./HomeOrb";
import { buttonPrimary } from "../../components/buttonClasses";
import { HomeNavigation, type HomeSection } from "../../components/HomeNavigation";
import { useDailyVerse } from "./dailyVerse";

type HomePageProps = { agent: string; activeTab?: HomeSection; onTabChange?: (tab: HomeSection) => void; onTalk: () => void; onType: () => void; onReviewChange: () => void; onNotes: () => void; onChurch: () => void; onSettings?: () => void };

export function HomePage({ agent, activeTab, onTabChange, onTalk, onType, onReviewChange, onNotes, onChurch, onSettings = () => {} }: HomePageProps) {
  const [localTab, setLocalTab] = useState<HomeSection>("Home");
  const tab = activeTab ?? localTab;
  const dailyVerse = useDailyVerse();
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
  return <section className="home-page">
    {tab === "Music" ? <MusicPanel onTalk={onTalk} /> : <div className="home-content min-h-0 flex-1">
      <HomeOrb />
      <article className="home-verse" aria-label="Daily verse">
        
        <p className="home-verse-text" tabIndex={0} aria-label={dailyVerse.text}>“{visibleVerse}”</p>
        <p className="mb-0 mt-0.5 text-[8px] text-[#aabcca]">{dailyVerse.reference} · {dailyVerse.translation}</p>
      </article>
      <div className="home-actions flex w-[108px] shrink-0 flex-col items-stretch gap-1">
        <button className={`${buttonPrimary} !h-[26px] !min-w-0 !px-2 !text-[9px]`} onClick={onTalk}><MicIcon />Talk to NEAR</button>
        <button className="inline-flex cursor-pointer items-center justify-center gap-1 border-0 bg-transparent py-0.5 text-[8px] text-[#aab7c4] hover:text-white" onClick={onType}><KeyboardIcon />Chat with NEAR</button>
      </div>
    </div>}
    <div className="home-navigation"><HomeNavigation active={tab} onNavigate={(next) => { if (next === "Settings") { onSettings(); return; } if (onTabChange) onTabChange(next); else setLocalTab(next); if (next === "Bible") onReviewChange(); if (next === "Notes") onNotes(); if (next === "Church") onChurch(); }} /></div>
    <span className="sr-only">Connected agent: {agent}</span>
  </section>;
}

function MicIcon() { return <svg className="h-3.5 w-3.5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]" viewBox="0 0 18 18" aria-hidden="true"><rect x="6" y="2" width="6" height="10" rx="3"/><path d="M3.5 9a5.5 5.5 0 0 0 11 0M9 14.5V17m-3 0h6"/></svg>; }
function KeyboardIcon() { return <svg className="h-3 w-3 fill-none stroke-current [stroke-width:1.4]" viewBox="0 0 18 18" aria-hidden="true"><rect x="1.5" y="4" width="15" height="10" rx="1.5"/><path d="M4 7h.1M7 7h.1M10 7h.1M13 7h.1M4 10h.1M7 10h.1M10 10h.1M13 10h.1M6 12h6"/></svg>; }
