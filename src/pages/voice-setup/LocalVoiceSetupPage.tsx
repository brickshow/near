import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";
import { VoicePicker } from "./VoicePicker";

type Props = { voiceName: string; onVoiceChange: (id: string) => void; onContinue: () => void; onUseTyping: () => void };

export function LocalVoiceSetupPage({ voiceName, onVoiceChange, onContinue, onUseTyping }: Props) {
  return <section className="flex flex-col gap-2 px-[22px] py-2">
    <div><h1 className="m-0 text-[16px] font-semibold text-[#f0f4f9]">Download an offline voice</h1><p className="m-0 text-[10px] text-[#b8c4d1]">Choose how NEAR sounds. Download and preview it here.</p></div>
    <VoicePicker voiceName={voiceName} onVoiceChange={onVoiceChange} />
    <div className="flex justify-end gap-2">
      <button type="button" className={buttonSecondary} onClick={onUseTyping}>Use typing</button>
      <button type="button" className={buttonPrimary} onClick={onContinue}>Continue</button>
    </div>
  </section>;
}
