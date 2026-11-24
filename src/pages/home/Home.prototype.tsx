// THROWAWAY: Which layout best fits Home in the existing 680 × 180 notch?
// Three variants on /?variant=A|B|C, using the real frame, header and verse data.
import { useState } from "react";
import { NotchFrame } from "../../components/NotchFrame";
import { NotchHeader } from "../../components/NotchHeader";
import { HomeNavigation, type HomeSection } from "../../components/HomeNavigation";
import { ParticleOrb } from "../../components/ParticleOrb";
import { PrototypeSwitcher } from "../../components/PrototypeSwitcher";
import { HomePage } from "./HomePage";
import { useDailyVerse, type DailyVerse } from "./dailyVerse";
import "./Home.prototype.css";

type Props = { verse: DailyVerse; act: (action: string) => void };

export function VariantB({ verse, act }: Props) {
  return <div className="prototype-editorial">
    <article>
      
      <p tabIndex={0}>“{verse.text}”</p>
      <span className="prototype-source">{verse.reference} · {verse.translation}</span>
    </article>
    <aside><ParticleOrb className="h-8 w-8" /><button onClick={() => act("Talk to NEAR")}>Talk to NEAR ↗</button><button onClick={() => act("Chat with NEAR")}>Open chat</button></aside>
  </div>;
}

export function VariantC({ verse, act }: Props) {
  return <div className="prototype-assistant">
    <div className="prototype-assistant-controls"><div className="prototype-assistant-title"><ParticleOrb className="h-9 w-9" /><div><strong>I'm here for you.</strong><span>Start a conversation</span></div></div>
      <div className="prototype-action-pair"><button onClick={() => act("Talk to NEAR")}>Talk to NEAR</button><button onClick={() => act("Chat with NEAR")}>Chat</button></div>
    </div>
    <article><p tabIndex={0}>“{verse.text}”</p><span className="prototype-source">{verse.reference} · {verse.translation}</span></article>
  </div>;
}

export default function HomePrototype() {
  const initial = new URLSearchParams(location.search).get("variant") ?? "A";
  const [variant, setVariant] = useState(["A", "B", "C"].includes(initial) ? initial : "A");
  const [action, setAction] = useState("None");
  const [tab, setTab] = useState<HomeSection>("Home");
  const verse = useDailyVerse();
  function switchVariant(key: string) {
    const url = new URL(location.href);
    url.searchParams.set("variant", key);
    history.replaceState(null, "", url);
    setVariant(key); setAction("None"); setTab("Home");
  }
  return <div className="prototype-stage">
    <NotchFrame previewSize={{ width: 680, height: 180 }} collapsed={null} onPointerEnter={() => {}} onPointerLeave={() => {}} onPointerDown={() => {}}>
      <NotchHeader status="ChatGPT connected" tone="success" onCollapse={() => setAction("Collapse")} onSettings={() => setAction("Settings")} onMicrophone={() => setAction("Microphone")} />
      <div style={{ height: "calc(100% - 30px)" }}>
        {variant === "A" ? <HomePage key={variant} agent="ChatGPT" onTalk={() => setAction("Talk to NEAR")} onType={() => setAction("Chat with NEAR")} onFaithJourney={() => setAction("Faith Journey")} onReviewChange={() => setAction("Bible")} onNotes={() => setAction("Notes")} onChurch={() => setAction("Church Calendar")} /> :
          <section className="home-page">
            {variant === "B" ? <VariantB verse={verse} act={setAction} /> : <VariantC verse={verse} act={setAction} />}
            <div className="home-navigation"><HomeNavigation active={tab} onNavigate={next => { setTab(next); setAction(next); }} /></div>
          </section>}
      </div>
    </NotchFrame>
    <div className="prototype-notes"><strong>{variant === "A" ? "Balanced row" : variant === "B" ? "Verse first" : "Assistant first"}</strong>
      <p>{variant === "A" ? "The orb, verse and actions share one centerline. The verse uses the remaining width; navigation has its own safe space." : variant === "B" ? "An open reading surface with a quiet accent line. Conversation lives in a compact rail beside the verse." : "Conversation gets a dedicated left panel. The daily verse becomes a quieter companion on the right."}</p>
      <output>Variant: {variant} · Last action: {action} · Navigation: {variant === "A" ? "in Home component" : tab} · Agent: ChatGPT · Mic: off · Verse: {verse.reference} ({verse.translation})</output>
      <p>Throwaway preview. Buttons only show their action here.</p>
    </div>
    <PrototypeSwitcher current={variant} onChange={switchVariant} />
  </div>;
}
