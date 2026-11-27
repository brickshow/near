import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { NotchFrame } from "./NotchFrame";
import { useNotchWindow } from "../hooks/useNotchWindow";
import { stopNearVoice } from "../lib/voice";
import "./AccessGate.css";

type AccessStatus = { remainingSeconds: number };
const AccessContext = createContext<AccessStatus | null>(null);
export function PreviewDuration() {
  const status = useContext(AccessContext);
  if (!status || status.remainingSeconds === 0) return null;
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
  const allowed = !!status && status.remainingSeconds > 0;

  useEffect(() => {
    if (!isTauri()) { setError("Open the NEAR desktop app to use the Hackathon Preview."); setStarting(false); return; }
    let disposed = false;
    const stop = listen<string>("near://access-notice", event => { if (!disposed) setNotice(event.payload); });
    void invoke<AccessStatus>("access_activate")
      .then(value => { if (!disposed) setStatus(value); })
      .catch(e => { if (!disposed) setError(String(e)); })
      .finally(() => { if (!disposed) setStarting(false); });
    const timer = setInterval(() => {
      void invoke<AccessStatus | null>("access_status").then(value => {
        if (!disposed && value) setStatus(value);
      }).catch(e => {
        if (!disposed) { setStatus(null); setError(String(e)); }
      });
    }, 500);
    return () => { disposed = true; clearInterval(timer); void stop.then(fn => fn()); };
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
    try { setStatus(await invoke<AccessStatus>("access_activate")); }
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
  const expired = status?.remainingSeconds === 0;
  return <AccessShell expand={!starting}>
    <section className="access-panel" aria-label="NEAR access">
      <div className="access-copy">
        <span className="access-eyebrow"><i />NEAR · {dataView ? "Your personal space" : "AI for Church Hackathon 2026"}</span>
        <h1>{dataView ? "Your memories stay yours." : expired ? "Your journey doesn't have to end here." : starting ? "A little space. Seventy-two hours." : "Let’s try that again."}</h1>
        <p>{dataView ? "Export your notes, reminders, conversations, and reflections, or permanently delete your personal data." : expired ? "Your 72-hour preview has ended. Your notes and reflections are safe. Commercial licenses are coming soon." : "Your free 72-hour preview starts automatically on first launch, even offline. The timer runs while NEAR is closed."}</p>
        <p className="access-message" role="status">{dataMessage || error || (starting ? "Preparing your Hackathon Preview…" : "")}</p>
      </div>
      <div className="access-actions">
        {dataView ? <>
          <button disabled={busy} onClick={() => void exportData()}>Export personal data</button>
          <button className="access-secondary" disabled={busy} onClick={() => confirmDelete ? void deleteData() : setConfirmDelete(true)}>{confirmDelete ? "Permanently delete data" : "Delete personal data"}</button>
          {confirmDelete && <button className="access-link" onClick={() => setConfirmDelete(false)}>Cancel deletion</button>}
          <button className="access-link" onClick={() => { setDataView(false); setConfirmDelete(false); setDataMessage(""); }}>Back</button>
        </> : <>
          {expired ? <button onClick={() => { void invoke("access_open_landing").catch(e => setError(String(e))); }}>Buy NEAR — $10 <span aria-hidden="true">↗</span></button> : !starting ? <button disabled={busy || !isTauri()} onClick={() => void retry()}>{busy ? "Starting…" : "Try again"}</button> : <span className="access-gentle">Welcome to NEAR</span>}
          {expired && <small>Licenses coming soon · Learn more</small>}
          <button className="access-link" onClick={() => { setDataView(true); setDataMessage(""); }}>Manage personal data</button>
        </>}
      </div>
    </section>
  </AccessShell>;
}
function AccessShell({ children, expand }: { children: ReactNode; expand: boolean }) {
  const docked = new URLSearchParams(location.search).has("window");
  const { resizeNotch, settledOpen, size } = useNotchWindow();
  useEffect(() => { if (!docked && expand) resizeNotch(true, true); }, [docked, expand, resizeNotch]);
  if (docked) return <div className="access-docked">{children}</div>;
  return <NotchFrame size={size} settledOpen={settledOpen} collapsed={<span />} onPointerEnter={() => {}} onPointerLeave={() => {}} onPointerDown={() => {}}>{children}</NotchFrame>;
}
