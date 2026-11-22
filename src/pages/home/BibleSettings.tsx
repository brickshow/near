import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type Bible = { id: string; name: string; downloadBytes: number; installed: boolean };
type DownloadProgress = { versionId: string; stage: string; downloadedBytes: number; totalBytes: number; error: string | null };
type BibleCatalog = { versions: Bible[]; download: DownloadProgress | null };

export function BibleSettings() {
  const [catalog, setCatalog] = useState<BibleCatalog | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let unlisten: (() => void) | undefined;
    const refresh = async () => {
      const next = await invoke<BibleCatalog>("list_near_bibles");
      if (active) { setCatalog(next); setProgress(next.download); }
    };
    void listen<DownloadProgress>("near://bible-download", ({ payload }) => {
      if (!active) return;
      setProgress(payload);
      if (payload.error) setError(payload.error);
      if (payload.stage === "Ready" || payload.stage === "Failed") {
        void refresh().catch(cause => setError(String(cause)));
      }
    }).then(stop => {
      if (!active) { stop(); return; }
      unlisten = stop;
      return refresh();
    }).catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; unlisten?.(); };
  }, []);

  const bible = catalog?.versions.find(version => version.id === "asv");
  const downloading = pending || !!progress && !["Ready", "Failed"].includes(progress.stage);
  const percent = progress ? Math.min(100, Math.round(progress.downloadedBytes / Math.max(progress.totalBytes, 1) * 100)) : 0;

  const download = async () => {
    if (!bible || bible.installed || downloading) return;
    setPending(true);
    setError("");
    try {
      await invoke("download_near_bible", { versionId: bible.id });
      const next = await invoke<BibleCatalog>("list_near_bibles");
      setCatalog(next);
      setProgress(next.download);
    } catch (cause) {
      setError(String(cause));
      setProgress(null);
    } finally {
      setPending(false);
    }
  };

  return <>
    <div className="settings-bible-row">
      <div>
        <strong>{bible?.name ?? "American Standard Version (ASV)"}</strong>
        <span>{bible?.installed ? "Available offline" : "Stored on this device after download"}</span>
      </div>
      <button type="button" disabled={!bible || bible.installed || downloading} onClick={() => void download()}>
        {downloading ? `${percent}%` : bible?.installed ? "Installed" : "Download"}
      </button>
    </div>
    {downloading && <progress className="settings-bible-progress" value={percent} max={100} aria-label={`Bible download ${percent}%`} />}
    {error && <p className="notes-error" role="alert">{error}</p>}
    {!isTauri() && <p>Open the NEAR desktop app to download the Bible.</p>}
  </>;
}
