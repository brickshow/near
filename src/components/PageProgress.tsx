import type { MouseEvent } from "react";

type PageProgressProps = { page: string; onNavigate: (page: "welcome" | "test-voice" | "bible-setup" | "local-data" | "choose-agent") => void };
const stepPages = ["welcome", "test-voice", "bible-setup", "local-data", "choose-agent"] as const;

export function PageProgress({ page, onNavigate }: PageProgressProps) {
  const matchedStep = stepPages.indexOf(page as typeof stepPages[number]);
  const active = matchedStep === -1 ? stepPages.length - 1 : matchedStep;
  const handleClick = (event: MouseEvent<HTMLButtonElement>, target: typeof stepPages[number]) => {
    event.stopPropagation();
    onNavigate(target);
  };
  return <footer className="absolute bottom-[8px] left-0 right-0 z-[2] flex h-[22px] items-center justify-center border-t border-white/[0.07] bg-[#08131d]" aria-label="Onboarding progress">
    {stepPages.map((target, index) => <span className="flex items-center" key={target}>
      {index > 0 && <i className="mx-[7px] h-px w-[25px] bg-[#89a3bc]/[0.43]" />}
      <button type="button" className={`grid h-[17px] w-[17px] cursor-pointer place-items-center rounded-full border text-[9px] font-bold ${index === active ? "border-[#49ddeb] bg-[#49ddeb] text-[#052433] shadow-[0_0_10px_rgba(69,222,238,0.3)]" : index < active ? "border-[#25d8e7] text-[#25d8e7]" : "border-[#86a1bb]/[0.48] text-[#9baabb]"}`} aria-label={`Go to step ${index + 1}`} onClick={(event) => handleClick(event, target)}>
        {index < active ? <CheckIcon /> : index + 1}
      </button>
    </span>)}
  </footer>;
}

function CheckIcon() { return <svg className="h-[11px] w-[11px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.7]" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.3 6.2 2.3 2.2 5.1-5" /></svg>; }
