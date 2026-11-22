import { useId } from "react";
import "./BibleOpening.css";

export function BibleOpening({ speaking = false, compact = false }: { speaking?: boolean; compact?: boolean }) {
  const id = useId();
  return <div className={`bible-scene${speaking ? " is-speaking" : ""}${compact ? " is-compact" : ""}`} aria-hidden="true">
    <div className="bible-ground" />
    <div className="bible-radiance"><div className="bible-radiance-pulse" /></div>
    <div className="bible-beam-rise">
      <svg viewBox="0 0 280 142" fill="none">
        <defs><linearGradient id={`${id}-light`} x1="140" y1="105" x2="140" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#fff1b7" stopOpacity=".65"/><stop offset=".5" stopColor="#9be9e5" stopOpacity=".16"/><stop offset="1" stopColor="#84dce9" stopOpacity="0"/></linearGradient></defs>
        <path d="m137 106-52-101q55-20 110 0l-52 101Z" fill={`url(#${id}-light)`} />
      </svg>
    </div>
    <div className="bible-binding">
      <svg viewBox="0 0 280 142" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M140 62C102 43 62 38 28 46L10 111c42-13 88-7 126 13q4 3 8 0c38-20 84-26 126-13l-18-65c-34-8-74-3-112 16Z" fill="#10242f" stroke="#5c8f9a" strokeWidth="1.4" />
        <path d="M15 105c42-11 84-5 121 15q4 3 8 0c37-20 79-26 121-15M18 100c41-9 82-4 118 15q4 3 8 0c36-19 77-24 118-15" stroke="#9ebabc" strokeWidth=".8" />
        <path d="M134 111v10q6 7 12 0v-10" stroke="#b0d6d6" strokeWidth="1.2" />
        <path d="m140 101 7 1 8 30-7-3-4 5Z" fill="#224249" stroke="#c9b67f" strokeWidth=".8" />
        <path d="m29 104-2 9m-3-5 9 1" stroke="#c5b68a" strokeWidth="1.2" />
      </svg>
    </div>
    <div className="bible-leaf bible-leaf-left">
      <svg viewBox="0 0 140 142" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <defs><linearGradient id={`${id}-left`} x1="15" y1="65" x2="140" y2="75" gradientUnits="userSpaceOnUse"><stop stopColor="#142c36"/><stop offset=".75" stopColor="#19363d"/><stop offset="1" stopColor="#081923"/></linearGradient></defs>
        <path d="M140 56C106 37 62 33 28 44l-13 58c42-10 91-5 125 15Z" fill={`url(#${id}-left)`} stroke="#c7dddd" strokeWidth="1.4" />
        <path d="M29 47c35-9 74-5 106 12l1 52" stroke="#e9f0df" strokeWidth=".7" opacity=".6" />
        <path d="M40 54q18-3 34 0m7 1q23 4 43 14M38 60q18-3 35 0m8 1q22 4 43 14M36 66q18-3 36 0m9 1q20 4 43 14M35 72q18-3 36 0m9 1q23 5 44 14M33 78q18-3 37 0m9 1q23 5 45 14M32 84q18-3 38 1m9 0q20 4 35 10" stroke="#85b0b6" strokeWidth=".8" opacity=".62" />
      </svg>
    </div>
    <div className="bible-leaf bible-leaf-right">
      <svg viewBox="0 0 140 142" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <defs><linearGradient id={`${id}-right`} x1="0" y1="75" x2="125" y2="65" gradientUnits="userSpaceOnUse"><stop stopColor="#081923"/><stop offset=".25" stopColor="#214049"/><stop offset="1" stopColor="#122a35"/></linearGradient></defs>
        <path d="M0 56C34 37 78 33 112 44l13 58C83 92 34 97 0 117Z" fill={`url(#${id}-right)`} stroke="#c7dddd" strokeWidth="1.4" />
        <path d="M5 59c32-17 71-21 106-12M4 111l1-52" stroke="#f5eed1" strokeWidth=".7" opacity=".7" />
        <path d="M16 66q20-10 39-13m8-1q21-3 37 1M16 72q20-10 39-13m8-1q21-3 39 1M16 78q20-10 39-13m8-1q21-3 40 1M16 84q20-10 39-13m8-1q21-3 42 1M16 90q20-10 39-13m8-1q21-3 43 1M16 96q20-10 39-13m8-1q21-3 30-1" stroke="#a4c6c6" strokeWidth=".8" opacity=".6" />
        <path d="m109 45 3-1 3 12q-4-5-6-11Z" fill="#294850" stroke="#d1e0d9" strokeWidth=".7" />
      </svg>
    </div>
    {["a", "b", "c"].map((page) => <div key={page} className={`bible-turning-page bible-turning-page-${page}`}>
      <svg viewBox="0 0 140 142" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M0 56C35 37 80 33 112 44l13 58C83 92 34 97 0 117Z" fill="#19333e" stroke="#dcebe2" strokeWidth="1" />
        <path d="M14 68q48-25 91-15M14 76q48-25 93-15M14 84q48-25 94-15M14 92q48-25 96-15" stroke="#86aeb4" strokeWidth=".7" />
      </svg>
    </div>)}
    <div className="bible-gutter"><svg viewBox="0 0 280 142" fill="none"><path d="M140 56q-4 25 0 61" stroke="#ffefbf" strokeWidth="1.1" strokeLinecap="round" /></svg></div>
    <div className="bible-dust"><i/><i/><i/><i/><i/></div>
  </div>;
}
