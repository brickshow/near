import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";
import { speakNear, stopNearVoice } from "../../lib/voice";

type Voice = { id: string; name: string; description: string; downloadBytes: number; installed: boolean };
type Progress = { voiceId: string; stage: string; downloadedBytes: number; totalBytes: number; error: string | null };
type Catalog = { supported: boolean; voices: Voice[]; download: Progress | null };
type Props = { voiceName: string; onVoiceChange: (id: string) => void; onLater?: () => void; onContinue?: () => void; previewText?: string };

export function VoicePicker({ voiceName, onVoiceChange, onLater, onContinue, previewText }: Props) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [pending, setPending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const mounted = useRef(false);
  const operation = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const refresh = async () => {
      const data = await invoke<Catalog>("list_near_voices");
      if (!disposed) { setCatalog(data); setProgress(data.download); }
    };
    if (isTauri()) {
      void listen<Progress>("near://voice-download", ({ payload }) => {
        if (disposed) return;
        setProgress(payload);
        if (payload.error) setError(payload.error);
        if (payload.stage === "Ready" || payload.stage === "Failed") {
          void refresh().catch((cause) => { if (!disposed) setError(String(cause)); });
        }
      }).then((dispose) => {
        if (disposed) { dispose(); return; }
        unlisten = dispose;
        return refresh();
      }).catch((cause) => { if (!disposed) setError(String(cause)); });
    } else {
      setError("Open the NEAR desktop app to download Bryce.");
    }
    return () => { disposed = true; mounted.current = false; unlisten?.(); stopNearVoice(); };
  }, []);

  const bryce = catalog?.voices[0];
  const downloading = pending || (!!progress && !["Ready", "Failed"].includes(progress.stage));
  const ready = !!bryce?.installed;
  const active = ready && voiceName === bryce?.id;
  const percent = progress ? Math.min(100, Math.floor(progress.downloadedBytes / Math.max(1, progress.totalBytes) * 100)) : 0;

  const download = async () => {
    if (!bryce || operation.current || downloading) return;
    operation.current = true;
    setPending(true); setError(""); setMessage("");
    stopNearVoice(); setPreviewing(false);
    try {
      await invoke("download_near_voice", { voiceId: bryce.id });
      const data = await invoke<Catalog>("list_near_voices");
      if (!mounted.current) return;
      setCatalog(data); setProgress(data.download);
      onVoiceChange(bryce.id);
      setMessage("Bryce is ready. Preview Genesis 1:1.");
    } catch (cause) {
      if (mounted.current) { setError(String(cause)); setProgress(null); }
    } finally {
      operation.current = false;
      if (mounted.current) setPending(false);
    }
  };

  const preview = () => {
    if (previewing) { stopNearVoice(); setPreviewing(false); setMessage(""); return; }
    if (!bryce) return;
    setError(""); setMessage("Preparing Genesis 1:1...");
    const speech = speakNear(previewText ?? "Hi, I'm NEAR. I'm here with you. Take your time, and tell me how you're feeling today.", bryce.id);
    if (!speech) { setError("Voice playback is unavailable on this device."); setMessage(""); return; }
    setPreviewing(true);
    speech.onstart = () => { if (mounted.current) setMessage("Playing Genesis 1:1..."); };
    speech.onend = () => { if (mounted.current) { setPreviewing(false); setMessage("Bryce is ready."); } };
    speech.onerror = (cause) => { if (mounted.current) { setPreviewing(false); setMessage(""); setError(cause); } };
  };

  return <div className="flex w-full flex-col gap-1.5">
    <div className="flex items-center gap-1.5">
      <span className="flex h-[29px] min-w-0 flex-1 items-center rounded-md border border-[#7289a0]/25 bg-[#101b27] px-2 text-[10px] text-[#e1e8ef]">Bryce <span className="ml-1.5 truncate text-[9px] text-[#b8c4d1]">· Piper · English (US) · Medium</span></span>
      {onLater ? <>
        <button type="button" className={`${buttonPrimary} !min-w-0 !px-3 disabled:cursor-default disabled:opacity-50`} disabled={downloading || !bryce || (!ready && !catalog?.supported)} onClick={() => {
          if (ready) { if (!active) onVoiceChange(bryce!.id); preview(); }
          else void download();
        }} aria-label={ready ? "Preview Genesis 1:1" : "Download Bryce voice"}>
          <ButtonIcon name={ready ? previewing ? "stop" : "preview" : "download"} />{downloading ? `Downloading ${percent}%` : ready ? previewing ? "Stop" : "Preview" : "Download"}
        </button>
        <button type="button" className={`${ready ? buttonPrimary : buttonSecondary} !min-w-0 !px-3`} onClick={ready ? onContinue : onLater}>
          <ButtonIcon name={ready ? "continue" : "later"} />{ready ? "Continue" : "Do it Later"}
        </button>
      </> : <>
        <button type="button" className={`${buttonPrimary} !min-w-0 !px-3 disabled:cursor-default disabled:opacity-50`} disabled={downloading || !catalog?.supported || !bryce || (ready && active)} onClick={() => {
          if (ready) { onVoiceChange(bryce.id); setMessage("Bryce selected."); }
          else void download();
        }} aria-label={ready ? active ? "Bryce selected" : "Use Bryce voice" : `Download Bryce voice (${Math.round((bryce?.downloadBytes ?? 0) / (1024 * 1024))} MB)`}>{downloading ? `Downloading ${percent}%` : ready ? active ? "Selected" : "Use Bryce" : "Download"}</button>
        <button type="button" className={`${buttonSecondary} !min-w-0 !px-3 disabled:cursor-default disabled:opacity-40`} disabled={!ready || downloading} onClick={preview}>{previewing ? "Stop" : "Preview"}</button>
      </>}
    </div>
    {downloading && <progress className="h-1 w-full accent-[#49dceb]" value={percent} max={100} aria-label="Bryce voice download progress" />}
    <p role={error ? "alert" : "status"} className={`m-0 text-[9px] leading-tight ${error ? "text-[#ff9c8f]" : "text-[#b8c4d1]"}`}>
      {error || (downloading ? `${progress?.stage ?? "Starting download"} - ${percent}%` : message || (!catalog ? "Connecting to NEAR..." : !catalog.supported ? "Bryce offline voice is not available for this device. Your system voices are still available." : ready ? "Downloaded to this device. Ready to use offline." : "Optional additional resource · 86 MB download · Stored in app data, not in the app build."))}
    </p>
  </div>;
}

function ButtonIcon({ name }: { name: "download" | "later" | "preview" | "stop" | "continue" }) {
  const className = "h-3 w-3 shrink-0 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]";
  if (name === "download") return <svg className={className} viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8m-3-3 3 3 3-3M3 12.5h10" /></svg>;
  if (name === "later") return <svg className={className} viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.5v3.8l2.5 1.4" /></svg>;
  if (name === "preview") return <svg className={className} viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6v4h3l4 3V3l-4 3zM12 6a3 3 0 0 1 0 4m1.5-6a5 5 0 0 1 0 8" /></svg>;
  if (name === "stop") return <svg className={className} viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1" /></svg>;
  return <svg className={className} viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8h10m-4-4 4 4-4 4" /></svg>;
}
