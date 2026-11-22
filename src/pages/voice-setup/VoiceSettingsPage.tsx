import { buttonPrimary } from "../../components/buttonClasses";
import { VoicePicker } from "./VoicePicker";

type VoiceSettingsPageProps = { voiceName: string; onVoiceChange: (voiceName: string) => void; onClose: () => void };

export function VoiceSettingsPage({ voiceName, onVoiceChange, onClose }: VoiceSettingsPageProps) {
  return <section className="flex flex-col gap-2 px-[22px] py-2">
    <div><h1 className="m-0 text-[16px] font-semibold text-[#f0f4f9]">Choose NEAR's voice</h1><p className="m-0 text-[10px] text-[#b8c4d1]">Download once, then listen offline. No website needed.</p></div>
    <VoicePicker voiceName={voiceName} onVoiceChange={onVoiceChange} />
    <div className="flex justify-end"><button type="button" className={buttonPrimary} onClick={onClose}>Done</button></div>
  </section>;
}
