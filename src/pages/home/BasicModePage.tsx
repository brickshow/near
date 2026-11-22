import { useState } from "react";
import { OnboardingPanel } from "../../components/OnboardingPanel";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";
import { HomeNavigation, type HomeSection } from "../../components/HomeNavigation";

type BasicModePageProps = { onConnect: () => void; onVerse: () => void; onReminders: () => void };

export function BasicModePage({ onConnect, onVerse, onReminders }: BasicModePageProps) {
  const [tab, setTab] = useState<HomeSection>("Home");
  return <OnboardingPanel icon="orb" frameOrb title="Your essentials are ready" description="You can still use local features while offline." footer={<HomeNavigation active={tab} onNavigate={setTab} />}>
    <div className="flex w-full flex-col gap-2">
      <button className={`${buttonPrimary} self-start`} onClick={onConnect}>↗ &nbsp; Connect an agent</button>
      <div className="flex flex-wrap gap-1.5">
        <button className={buttonSecondary} onClick={onVerse}>▤ &nbsp; Read today’s verse</button>
        <button className={buttonSecondary} onClick={() => setTab("Notes")}>▤ &nbsp; New note</button>
        <button className={buttonSecondary} onClick={onReminders}>♧ &nbsp; View reminders</button>
      </div>
    </div>
  </OnboardingPanel>;
}
