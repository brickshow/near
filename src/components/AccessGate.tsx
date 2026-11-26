import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { NotchFrame } from "./NotchFrame";
import { useNotchWindow } from "../hooks/useNotchWindow";
import { stopNearVoice } from "../lib/voice";
import "./AccessGate.css";

export type AccessStatus = {
  state: "preview_not_activated" | "preview_active" | "preview_expired" | "commercial_license_active" | "commercial_license_invalid";
  activatedAt: number | null; expiresAt: number | null; serverNow: number;
  activationsEnabled: boolean; verified: boolean; message: string; remainingSeconds: number;
};
const AccessContext = createContext<AccessStatus | null>(null);
export function PreviewDuration() {
  const status = useContext(AccessContext);
  if (status?.state !== "preview_active") return null;
  const hours = Math.floor(status.remainingSeconds / 3600);
  const minutes = Math.floor((status.remainingSeconds % 3600) / 60);
  return <p className="preview-duration">Hackathon Preview · {hours > 0 ? `${hours}h ` : ""}{minutes}m remaining</p>;
}

export function AccessGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(true);
  const [notice, setNotice] = useState("");
  const [dataView, setDataView] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dataMessage, setDataMessage] = useState("");
  const allowed = !!status?.verified && ["preview_active", "commercial_license_active"].includes(status.state);

  useEffect(() => {
    if (!isTauri()) { setError("Open the NEAR desktop app to use the Hackathon Preview."); setStarting(false); return; }
    let disposed = false;
    let activationTimer: ReturnType<typeof setTimeout> | undefined;
    // This disclosure is visible BEFORE any activation request. The launch then
    // activates automatically; there is no registration or license-key flow.
    void invoke<AccessStatus>("access_refresh", { activate: false }).then(value => {
      if (disposed) return;
      setStatus(value);
      if (value.state === "preview_not_activated" && value.activationsEnabled) {
        activationTimer = setTimeout(() => {
          if (!disposed) void invoke<AccessStatus>("access_refresh", { activate: true })
            .then(value => { if (!disposed) { setStatus(value); setStarting(false); } })
            .catch(e => { if (!disposed) { setError(String(e)); setStarting(false); } });
        }, 6500);
      } else setStarting(false);
    }).catch(e => { if (!disposed) { setError(String(e)); setStarting(false); } });
    const timer = setInterval(() => {
      void invoke<AccessStatus>("access_status").then(value => {
        if (!disposed && value.serverNow > 0) { setStatus(value); if (value.verified) setError(""); }
      }).catch(() => {});
    }, 500);
    const stop = listen<string>("near://access-notice", event => { if (!disposed) setNotice(event.payload); });
    return () => { disposed = true; clearInterval(timer); clearTimeout(activationTimer); void stop.then(fn => fn()); };
  }, []);
  useEffect(() => {
    if (!allowed) stopNearVoice();
  }, [allowed]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 15000);
    return () => clearTimeout(timer);
  }, [notice]);
  const retry = async () => {
    setBusy(true); setError("");
    try { setStatus(await invoke<AccessStatus>("access_refresh", { activate: true })); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };
  const exportData = async () => {
    setBusy(true); setDataMessage("");
    try {
      const preferences = Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith("near.")));
      const saved = await invoke<boolean>("access_export_data", { preferences });
      if (saved) setDataMessage("Your personal data was exported.");
    } catch (e) { setDataMessage(String(e)); }
    finally { setBusy(false); }
  };
  const deleteData = async () => {
    setBusy(true); setDataMessage("");
    try {
      await invoke("access_delete_data");
      localStorage.clear(); setConfirmDelete(false); setDataMessage("Your personal data was deleted. Your preview dates are preserved.");
    } catch (e) { setDataMessage(String(e)); }
    finally { setBusy(false); }
  };
  if (allowed) return <AccessContext.Provider value={status}>{children}{notice && <div className="preview-notice" role="status">{notice}</div>}</AccessContext.Provider>;
  const expired = status?.state === "preview_expired";
  const disabled = status?.state === "preview_not_activated" && !status.activationsEnabled;
  return <AccessShell>
    <section className="access-panel" aria-label="NEAR access">
      <div className="access-copy">
        <span className="access-eyebrow"><i />NEAR · {dataView ? "Your personal space" : "AI for Church Hackathon 2026"}</span>
        <h1>{dataView ? "Your memories stay yours." : expired ? "Your journey doesn't have to end here." : disabled ? "A little pause, for now." : starting ? "A little space. Seventy-two hours." : "Let’s reconnect your journey."}</h1>
        <p>{dataView ? "Export your notes, reminders, conversations, and reflections, or permanently delete your personal data." : expired ? "Your 72-hour preview has ended. Your notes and reflections are safe. Commercial licenses are coming soon." : disabled ? "New Hackathon Previews have closed. Existing previews keep their original expiration dates." : "Your free 72-hour preview starts automatically on first launch and runs even while NEAR is closed. No account, payment, or key. Internet is required to verify access."}</p>
        <p className="access-message" role="status">{dataMessage || error || (!starting ? status?.message : "Preparing your Hackathon Preview…")}</p>
      </div>
      <div className="access-actions">
        {dataView ? <>
          <button disabled={busy} onClick={() => void exportData()}>Export personal data</button>
          <button className="access-secondary" disabled={busy} onClick={() => confirmDelete ? void deleteData() : setConfirmDelete(true)}>{confirmDelete ? "Permanently delete data" : "Delete personal data"}</button>
          {confirmDelete && <button className="access-link" onClick={() => setConfirmDelete(false)}>Cancel deletion</button>}
          <button className="access-link" onClick={() => { setDataView(false); setConfirmDelete(false); setDataMessage(""); }}>Back</button>
        </> : <>
          {expired ? <button onClick={() => { void invoke("access_open_landing").catch(e => setError(String(e))); }}>Buy NEAR — $10 <span aria-hidden="true">↗</span></button> : !starting && !disabled ? <button disabled={busy || !isTauri()} onClick={() => void retry()}>{busy ? "Connecting…" : "Retry connection"}</button> : <span className="access-gentle">{disabled ? "Licenses coming soon" : "Welcome to NEAR"}</span>}
          {expired && <small>Licenses coming soon · Learn more</small>}
          <button className="access-link" onClick={() => { setDataView(true); setDataMessage(""); }}>Manage personal data</button>
        </>}
      </div>
    </section>
  </AccessShell>;
}
function AccessShell({ children }: { children: ReactNode }) {
  const docked = new URLSearchParams(location.search).has("window");
  const { resizeNotch, previewSize } = useNotchWindow();
  useEffect(() => { if (!docked) resizeNotch(true, true); }, [docked, resizeNotch]);
  if (docked) return <div className="access-docked">{children}</div>;
  return <NotchFrame previewSize={previewSize} collapsed={<span />} onPointerEnter={() => {}} onPointerLeave={() => {}} onPointerDown={() => {}}>{children}</NotchFrame>;
}
