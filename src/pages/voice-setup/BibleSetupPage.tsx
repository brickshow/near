import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { OnboardingPanel } from "../../components/OnboardingPanel";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";

type Bible = { id: string; name: string; downloadBytes: number; installed: boolean };
type Progress = { versionId: string; stage: string; downloadedBytes: number; totalBytes: number; error: string | null };
type Catalog = { versions: Bible[]; download: Progress | null };

type Props = { onContinue: () => void; onLater: () => void };

export function BibleSetupPage({ onContinue, onLater }: Props) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const operation = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const refresh = async () => {
      const data = await invoke<Catalog>("list_near_bibles");
      if (!disposed) { setCatalog(data); setProgress(data.download); }
    };
    if (!isTauri()) {
      setError("Open the NEAR desktop app to download the ASV Bible.");
      return () => { disposed = true; mounted.current = false; };
    }
    void listen<Progress>("near://bible-download", ({ payload }) => {
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
    return () => { disposed = true; mounted.current = false; unlisten?.(); };
  }, []);

  const asv = catalog?.versions[0];
  const downloading = pending || (!!progress && !["Ready", "Failed"].includes(progress.stage));
  const ready = !!asv?.installed;
  const percent = progress ? Math.min(100, Math.floor(progress.downloadedBytes / Math.max(1, progress.totalBytes) * 100)) : 0;

  const download = async () => {
    if (!asv || operation.current || downloading) return;
    operation.current = true;
    setPending(true);
    setError("");
    try {
      await invoke("download_near_bible", { versionId: asv.id });
      const data = await invoke<Catalog>("list_near_bibles");
      if (mounted.current) { setCatalog(data); setProgress(null); }
    } catch (cause) {
      if (mounted.current) { setError(String(cause)); setProgress(null); }
    } finally {
      operation.current = false;
      if (mounted.current) setPending(false);
    }
  };

  return <OnboardingPanel icon="book" title="Download a Bible" description="Only the American Standard Version (ASV) is available. It stays on this device and is not included in the app installer.">
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="flex h-[29px] min-w-0 flex-1 items-center truncate rounded-md border border-[#7289a0]/25 bg-[#101b27] px-2 text-[10px] text-[#e1e8ef]">{asv?.name ?? "American Standard Version (ASV)"}</span>
        <button type="button" className={`${buttonPrimary} !min-w-0 !px-3 disabled:cursor-default disabled:opacity-50`} disabled={downloading || !asv || ready} onClick={() => void download()}>{downloading ? `Downloading ${percent}%` : ready ? "Downloaded" : "Download"}</button>
        <button type="button" className={`${ready ? buttonPrimary : buttonSecondary} !min-w-0 !px-3`} onClick={ready ? onContinue : onLater}>{ready ? "Continue" : "Do it Later"}</button>
      </div>
      {downloading && <progress className="h-1 w-full accent-[#49dceb]" value={percent} max={100} aria-label="ASV Bible download progress" />}
      <p role={error ? "alert" : "status"} className={`m-0 text-[9px] leading-tight ${error ? "text-[#ff9c8f]" : "text-[#b8c4d1]"}`}>
        {error || (downloading ? `${progress?.stage ?? "Starting download"} - ${percent}%` : ready ? "ASV is downloaded and available offline." : !catalog ? "Connecting to NEAR..." : "Optional additional resource · about 5.5 MB · stored in app data, not in the app build.")}
      </p>
    </div>
  </OnboardingPanel>;
}
