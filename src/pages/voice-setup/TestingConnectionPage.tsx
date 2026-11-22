import { useEffect } from "react";
import { OnboardingPanel } from "../../components/OnboardingPanel";
import { buttonSecondary } from "../../components/buttonClasses";

type TestingConnectionPageProps = { onCancel: () => void; onReady: () => void };

export function TestingConnectionPage({ onCancel, onReady }: TestingConnectionPageProps) {
  useEffect(() => {
    const timer = window.setTimeout(onReady, 2300);
    return () => window.clearTimeout(timer);
  }, [onReady]);

  return <OnboardingPanel icon="loading" title="Checking your agent" description=" ">
    <div className="flex w-full items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center">
          <Step number="1" label="Agent found" complete />
          <i className="h-px flex-1 bg-gradient-to-r from-[#36dbe7] to-[#62788c]" />
          <Step number="2" label="Checking access" complete />
          <i className="h-px flex-1 bg-[#71849a]/50" />
          <Step number="3" label="Testing reply" />
        </div>
      </div>
      <button className={buttonSecondary} onClick={onCancel}>Cancel</button>
    </div>
  </OnboardingPanel>;
}

function Step({ number, label, complete = false }: { number: string; label: string; complete?: boolean }) {
  return <div className="flex min-w-[68px] flex-col items-center gap-1 text-[9px] text-[#c0cbd7]">
    <span className={`grid h-[17px] w-[17px] place-items-center rounded-full border ${complete ? "border-[#32dce9] bg-[#32dce9]/20 text-[#65f3f5]" : "border-[#8797a8]/60 text-[#a9b8c6]"}`}>{complete ? "✓" : number}</span>
    <span className="whitespace-nowrap">{label}</span>
  </div>;
}
