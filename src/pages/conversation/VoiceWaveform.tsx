const BARS = [5, 9, 14, 8, 18, 12, 22, 14, 24, 17, 11, 20, 13, 23, 15, 9, 18, 12, 24, 16, 10, 19, 12, 6];

export type VoiceAnimationMode = "ready" | "recording" | "analyzing" | "speaking";

export function VoiceWaveform({ mode = "recording", active }: { mode?: VoiceAnimationMode; active?: boolean }) {
  const currentMode = active === undefined ? mode : active ? "recording" : "ready";
  const modeStyle = {
    ready: "text-[#38baca]",
    recording: "text-[#38efd1]",
    analyzing: "text-[#9e8dff]",
    speaking: "text-[#54dcff]",
  }[currentMode];
  const animation = {
    ready: "animate-voice-idle opacity-45",
    recording: "animate-voice-wave opacity-100",
    analyzing: "animate-voice-analyze opacity-80",
    speaking: "animate-voice-speak opacity-100",
  }[currentMode];
  const label = {
    ready: "Ready to record",
    recording: "Recording",
    analyzing: "AI is analyzing",
    speaking: "AI is speaking",
  }[currentMode];
  return <div className={`relative flex h-12 w-full max-w-[260px] items-center justify-center gap-[3px] overflow-hidden ${modeStyle}`} aria-label={label} role="img">
    <span className={`pointer-events-none absolute inset-x-[18%] top-1/2 h-4 -translate-y-1/2 rounded-full bg-current opacity-20 blur-xl ${currentMode === "ready" ? "animate-voice-idle" : "animate-pulse"} motion-reduce:animate-none`} />
    {currentMode === "analyzing" && <span className="pointer-events-none absolute inset-y-1 left-[12%] w-px animate-voice-scan bg-current opacity-80 shadow-[0_0_10px_currentColor] motion-reduce:animate-none" />}
    {BARS.map((height, index) => <i key={index} className={`${animation} motion-reduce:animate-none relative z-[1] w-[3px] shrink-0 rounded-full bg-current shadow-[0_0_7px_currentColor]`} style={{ height: `${height}px`, animationDelay: `${index * (currentMode === "analyzing" ? 44 : 30)}ms`, animationDuration: currentMode === "recording" ? "520ms" : currentMode === "speaking" ? `${320 + (index % 5) * 45}ms` : undefined }} />)}
  </div>;
}
