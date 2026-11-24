type NotchHeaderProps = { status: string; tone?: "neutral" | "success" | "error" | "warning"; microphoneStatus?: "off" | "listening" | "speaking"; onCollapse: () => void; onSettings?: () => void; onMicrophone?: () => void };

export function NotchHeader({ status, tone = "neutral", microphoneStatus = "off", onCollapse, onSettings, onMicrophone }: NotchHeaderProps) {
  const microphoneLabel = microphoneStatus === "listening" ? "Listening" : microphoneStatus === "speaking" ? "Speaking" : "Mic off";
  const statusTone = {
    neutral: "bg-[#21e5d0] shadow-[0_0_12px_rgba(33,229,208,0.72)]",
    success: "bg-[#21e5d0] shadow-[0_0_12px_rgba(33,229,208,0.65)]",
    error: "bg-[#fa625e] shadow-[0_0_9px_rgba(250,98,94,0.65)]",
    warning: "bg-[#ff9b45] shadow-[0_0_9px_rgba(255,155,69,0.65)]",
  }[tone];
  return (
    <header className="near-header">
      <span className="near-wordmark">NEAR</span>
      <span className={`near-status ${tone === "error" ? "is-error" : ""}`}><i className={statusTone} />{status}</span>
      <span className="flex-1" />
      <button className="near-header-action" aria-label={microphoneLabel} onClick={onMicrophone}><MicIcon muted={microphoneStatus === "off"} /><span>{microphoneLabel}</span></button>
      <span className="near-header-divider" />
      <button className="near-header-action near-settings-button" aria-label="Settings" onClick={onSettings}><GearIcon /></button>
      <button className="near-header-action near-collapse-button" aria-label="Collapse NEAR" onClick={onCollapse}>⌃</button>
    </header>
  );
}

function MicIcon({ muted }: { muted: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Zm-4 7a7 7 0 0 0 14 0M12 19v3m-4 0h8" />{muted && <path d="m4 4 16 16"/>}</svg>;
}

function GearIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 3h5l.8 2.2 1.5.9 2.3-.6 2.5 4.3-1.7 1.7v1.8l1.7 1.7-2.5 4.3-2.3-.6-1.5.9-.8 2.2h-5l-.8-2.2-1.5-.9-2.3.6-2.5-4.3 1.7-1.7v-1.8l-1.7-1.7 2.5-4.3 2.3.6 1.5-.9L9.5 3Z"/><circle cx="12" cy="12" r="3" /></svg>;
}
