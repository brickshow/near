import { useState } from "react";
import { NEAR_VOICE_KEY } from "../../lib/voice";
import { SettingsPage } from "./SettingsPage";

export function SettingsWindow() {
  const [voiceName, setVoiceName] = useState(() => localStorage.getItem(NEAR_VOICE_KEY) ?? "");
  const changeVoice = (voice: string) => {
    localStorage.setItem(NEAR_VOICE_KEY, voice);
    setVoiceName(voice);
  };
  return <SettingsPage voiceName={voiceName} onVoiceChange={changeVoice} />;
}
