import { useState } from "react";
import { OnboardingPanel } from "../../components/OnboardingPanel";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";

type FinishSetupPageProps = { onBack: () => void; onFinish: () => void };

export function FinishSetupPage({ onBack, onFinish }: FinishSetupPageProps) {
  const [quietHours, setQuietHours] = useState(true);
  const [launchOnStart, setLaunchOnStart] = useState(false);
  return <OnboardingPanel icon="settings" title="Make NEAR comfortable" description=" ">
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[9px] text-[#d4dde7]">
        <label className="flex items-center gap-1.5"><span aria-hidden="true">◷</span> Daily verse
          <select className="h-[27px] rounded-md border border-[#7289a0]/25 bg-[#101b27] px-2 text-[9px] text-[#e1e8ef] outline-none"><option>8:00 AM</option><option>7:00 AM</option><option>9:00 AM</option></select>
        </label>
        <label className="flex items-center gap-1.5"><span aria-hidden="true">☾</span> Quiet hours
          <Toggle checked={quietHours} onChange={() => setQuietHours((value) => !value)} label="Quiet hours" />
        </label>
        <label className="flex items-center gap-1.5"><span aria-hidden="true">⊞</span> Start NEAR when I sign in
          <Toggle checked={launchOnStart} onChange={() => setLaunchOnStart((value) => !value)} label="Start NEAR when I sign in" />
        </label>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button className={buttonSecondary} onClick={onBack}>← &nbsp; Back</button>
        <button className={buttonPrimary} onClick={onFinish}>Finish setup</button>
      </div>
    </div>
  </OnboardingPanel>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className={`relative h-[17px] w-[31px] cursor-pointer rounded-full border transition-colors ${checked ? "border-[#32dce9] bg-[#32dce9]/70" : "border-[#7c8c9c]/65 bg-[#263543]"}`}>
    <span className={`absolute top-[2px] h-[11px] w-[11px] rounded-full bg-white transition-[left] ${checked ? "left-[17px]" : "left-[2px]"}`} />
  </button>;
}
