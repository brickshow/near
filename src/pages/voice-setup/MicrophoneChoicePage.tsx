import { OnboardingPanel } from "../../components/OnboardingPanel";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";

type MicrophoneChoicePageProps = { onEnableVoice: () => void; onUseTyping: () => void };

export function MicrophoneChoicePage({ onEnableVoice, onUseTyping }: MicrophoneChoicePageProps) {
  return <OnboardingPanel icon="microphone" title="Set up voice" description="NEAR transcribes speech locally. Your audio stays on this device; you choose whether to send the reviewed transcript to NEAR.">
    <button className={buttonPrimary} onClick={onEnableVoice}>Enable microphone</button>
    <button className={buttonSecondary} onClick={onUseTyping}><KeyboardIcon /> Use keyboard</button>
  </OnboardingPanel>;
}

function KeyboardIcon() {
  return <svg className="h-3.5 w-3.5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.4]" viewBox="0 0 18 18" aria-hidden="true"><rect x="1.5" y="4" width="15" height="10" rx="1.5"/><path d="M4 7h.1M7 7h.1M10 7h.1M13 7h.1M4 10h.1M7 10h.1M10 10h.1M13 10h.1M6 12h6"/></svg>;
}
