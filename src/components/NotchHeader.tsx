type NotchHeaderProps = { status: string; tone?: "neutral" | "success" | "error" | "warning"; microphoneStatus?: "off" | "listening" | "speaking"; onCollapse: () => void; onSettings?: () => void; onMicrophone?: () => void };

export function NotchHeader({ status, tone = "neutral", microphoneStatus = "off", onCollapse, onSettings, onMicrophone }: NotchHeaderProps) {
  const microphoneLabel = microphoneStatus === "listening" ? "Listening" : microphoneStatus === "speaking" ? "Speaking" : "Mic off";
  const statusTone = {
    neutral: "bg-[#52d8eb] shadow-[0_0_9px_rgba(85,225,238,0.72)]",
    success: "bg-[#38dfad] shadow-[0_0_9px_rgba(56,223,173,0.65)]",
    error: "bg-[#fa625e] shadow-[0_0_9px_rgba(250,98,94,0.65)]",
    warning: "bg-[#ff9b45] shadow-[0_0_9px_rgba(255,155,69,0.65)]",
  }[tone];
  return (
    <header className="relative z-[2] mx-auto flex h-[30px] w-full max-w-[560px] items-center gap-[11px] border-b border-white/[0.07] px-5">
      <span className="whitespace-nowrap text-[10px] font-bold tracking-[.28em] text-[#e8eff7]">NEAR</span>
      <span className={`flex items-center gap-[7px] whitespace-nowrap text-[9px] ${tone === "error" ? "text-[#ff7775]" : "text-[#d0d9e4]"}`}><i className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusTone}`} />{status}</span>
      <span className="flex-1" />
      <button className={`inline-flex cursor-pointer items-center gap-[5px] border-0 bg-transparent p-0 ${microphoneStatus === "off" ? "text-[#e0e7ef]" : "text-[#4ce3e9]"}`} aria-label={microphoneLabel} onClick={onMicrophone}><MicIcon muted={microphoneStatus === "off"} /><span className="text-[9px] text-[#d0d9e4]">{microphoneLabel}</span></button>
      <span className="mx-[5px] h-[15px] w-px bg-white/[0.26]" />
      <button className="inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-[#e0e7ef]" aria-label="Settings" onClick={onSettings}><GearIcon /></button>
      <button className="ml-px inline-flex cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-sm text-[#a9b7c5]" aria-label="Collapse NEAR" onClick={onCollapse}>⌃</button>
    </header>
  );
}

function MicIcon({ muted }: { muted: boolean }) {
  return <svg className="h-[13px] w-[13px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.35]" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4a2 2 0 0 1 4 0v4a2 2 0 0 1-4 0V4Zm-2 4a4 4 0 0 0 8 0M8 12v2m-2 0h4" />{muted && <path d="m3 3 10 10"/>}</svg>;
}

function GearIcon() {
  return <svg className="h-[14px] w-[14px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.35]" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.9 1.6h2.2l.4 1.5 1.2.7 1.5-.4 1.1 1.9-1.1 1.1v1.4l1.1 1.1-1.1 1.9-1.5-.4-1.2.7-.4 1.5H6.9l-.4-1.5-1.2-.7-1.5.4-1.1-1.9 1.1-1.1V6.4L2.7 5.3l1.1-1.9 1.5.4 1.2-.7.4-1.5Z"/><circle cx="8" cy="7.1" r="2" /></svg>;
}
