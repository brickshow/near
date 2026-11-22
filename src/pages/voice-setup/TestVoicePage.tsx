import { OnboardingPanel } from "../../components/OnboardingPanel";
import { VoicePicker } from "./VoicePicker";

const GENESIS_TEST = "In the beginning God created the heavens and the earth.";
type TestVoicePageProps = { onContinue: () => void; onLater: () => void; voiceName: string; onVoiceChange: (voiceName: string) => void };

export function TestVoicePage({ onContinue, onLater, voiceName, onVoiceChange }: TestVoicePageProps) {
  return <OnboardingPanel icon="microphone" title="Set up NEAR's voice" description="Download Bryce or preview the Genesis 1:1 reading.">
    <VoicePicker voiceName={voiceName} onVoiceChange={onVoiceChange} onLater={onLater} onContinue={onContinue} previewText={GENESIS_TEST} />
  </OnboardingPanel>;
}
