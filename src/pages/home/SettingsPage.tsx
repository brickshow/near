import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { VoicePicker } from "../voice-setup/VoicePicker";
import { BibleSettings } from "./BibleSettings";
import { AppModal } from "../../components/AppModal";
import { loadReminderPreferences, saveReminderPreferences } from "../../lib/reminderPreferences";
import { getTheme, MOTION_KEY, setReducedMotion, setTheme } from "../../lib/appearance";
import packageInfo from "../../../package.json";
import { loadCollapseDelaySeconds, loadMouseControl, loadNotchAutoHideSeconds, saveCollapseDelaySeconds, saveMouseControl, saveNotchAutoHideSeconds } from "../../lib/notchPreferences";
import { loadNoteMicrophone, saveNoteMicrophone } from "../../lib/notePreferences";
import "./SettingsPage.css";

type Props = { voiceName: string; onVoiceChange: (voiceName: string) => void };
type ChatGptStatus = { connected: boolean; email: string | null; plan_usage_enabled: boolean; message: string };

export function SettingsPage({ voiceName, onVoiceChange }: Props) {
  const [preferences, setPreferences] = useState(loadReminderPreferences);
  const [theme, updateTheme] = useState(getTheme);
  const [reducedMotion, updateReducedMotion] = useState(() => localStorage.getItem(MOTION_KEY) === "true");
  const [connection, setConnection] = useState<ChatGptStatus | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [version, setVersion] = useState(packageInfo.version);
  const [collapseDelaySeconds, setCollapseDelaySeconds] = useState(loadCollapseDelaySeconds);
  const [mouseControl, setMouseControl] = useState(loadMouseControl);
  const [mouseControlError, setMouseControlError] = useState("");
  const [autoHideSeconds, setAutoHideSeconds] = useState(loadNotchAutoHideSeconds);
  const [startAtLogin, setStartAtLogin] = useState(false);
  const [startupError, setStartupError] = useState("");
  const [confirmExit, setConfirmExit] = useState(false);
  const [noteMicrophone, setNoteMicrophone] = useState(loadNoteMicrophone);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const update = (change: Partial<typeof preferences>) => setPreferences(current => saveReminderPreferences({ ...current, ...change }));
  const refreshConnection = useCallback(async () => {
    try {
      setConnection(await invoke<ChatGptStatus>("chatgpt_status"));
      setConnectionError("");
    } catch (error) {
      setConnectionError(`Could not check ChatGPT connection: ${String(error)}`);
    }
  }, []);
  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let stopListening: (() => void) | undefined;
    void refreshConnection();
    void invoke("set_notch_mouse_control", { enabled: loadMouseControl() }).catch(error => setMouseControlError(String(error)));
    void invoke("set_notch_auto_hide_seconds", { seconds: loadNotchAutoHideSeconds() }).catch(error => setMouseControlError(String(error)));
    void invoke<boolean>("get_start_at_login").then(setStartAtLogin).catch(error => setStartupError(String(error)));
    void getVersion().then(setVersion).catch(() => {});
    void listen("near://chatgpt-auth-complete", () => void refreshConnection())
      .then(stop => { if (active) stopListening = stop; else stop(); })
      .catch(() => {});
    window.addEventListener("focus", refreshConnection);
    return () => {
      active = false;
      stopListening?.();
      window.removeEventListener("focus", refreshConnection);
    };
  }, [refreshConnection]);
  useEffect(() => {
    let active = true;
    const devices = navigator.mediaDevices;
    const refresh = () => void devices?.enumerateDevices().then(items => {
      if (active) setMicrophones(items.filter(item => item.kind === "audioinput" && item.deviceId && item.deviceId !== "default"));
    }).catch(() => {});
    refresh();
    devices?.addEventListener("devicechange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      devices?.removeEventListener("devicechange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const connectChatGpt = async () => {
    setConnecting(true);
    setConnectionError("");
    try {
      const url = await invoke<string>("chatgpt_begin_login");
      await openUrl(url);
    } catch (error) {
      setConnectionError(`Could not open ChatGPT sign-in: ${String(error)}`);
    } finally {
      setConnecting(false);
    }
  };
  return <main className="notes-window settings-window">
    <header className="notes-header settings-header">
      <div><h1>Settings</h1><p>Make NEAR comfortable for you.</p></div>
      <button className="settings-close" aria-label="Close settings" onClick={() => void getCurrentWindow().close()}>&times;</button>
    </header>
    <section className="settings-section" aria-labelledby="connection-settings-title">
      <h2 id="connection-settings-title">ChatGPT connection</h2>
      <p className={`settings-connection-status ${connection?.connected ? "is-connected" : ""}`} role="status">{connection?.message ?? "Checking connection..."}</p>
      {connection?.email && <p className="settings-detail"><span>Account</span><strong>{connection.email}</strong></p>}
      {connection?.connected && <p className="settings-detail"><span>Plan usage</span><strong>{connection.plan_usage_enabled ? "Enabled" : "Not enabled"}</strong></p>}
      {connectionError && <p className="notes-error" role="alert">{connectionError}</p>}
      <div className="settings-actions">
        {!connection?.connected && <button className="settings-primary-action" disabled={connecting} onClick={() => void connectChatGpt()}>{connecting ? "Opening sign-in..." : "Connect ChatGPT"}</button>}
        <button className="settings-secondary-action" onClick={() => void refreshConnection()}>Refresh status</button>
      </div>
    </section>
    <section className="settings-section settings-notch-section" aria-labelledby="notch-settings-title">
      <div className="settings-section-heading">
        <div><h2 id="notch-settings-title">Notch</h2><p>Choose when NEAR hides and how it wakes up.</p></div>
        <span className="settings-status-chip"><i />{autoHideSeconds === 0 ? "Always visible" : `Hides in ${autoHideSeconds}s`}</span>
      </div>
      <div className="settings-control-row">
        <div className="settings-control-copy"><strong>Hide NEAR after</strong><small>Completely hide the notch after mouse inactivity.</small></div>
        <select aria-label="Hide NEAR after" value={autoHideSeconds} onChange={async event => {
          const seconds = Number(event.target.value);
          setMouseControlError("");
          try {
            await invoke("set_notch_auto_hide_seconds", { seconds });
            saveNotchAutoHideSeconds(seconds);
            setAutoHideSeconds(seconds);
          } catch (error) {
            setMouseControlError(String(error));
          }
        }}>
          <option value={0}>Never</option><option value={5}>5 seconds</option>
          <option value={10}>10 seconds</option><option value={15}>15 seconds</option>
          <option value={30}>30 seconds</option><option value={60}>1 minute</option>
        </select>
      </div>
      <label className="settings-switch-row settings-mouse-control">
        <span className="settings-control-copy"><strong>Mouse movement control</strong><small>{mouseControl
          ? "Eyes follow the cursor. Moving it reveals NEAR after it hides."
          : "Movement will not move the eyes or reveal a hidden notch. Use the tray icon or Ctrl+Shift+Space."}</small></span>
        <input type="checkbox" checked={mouseControl} disabled={!isTauri()} onChange={async event => {
          const enabled = event.target.checked;
          setMouseControlError("");
          try {
            await invoke("set_notch_mouse_control", { enabled });
            saveMouseControl(enabled);
            setMouseControl(enabled);
          } catch (error) {
            setMouseControlError(String(error));
          }
        }} />
      </label>
      <div className="settings-control-row">
        <div className="settings-control-copy"><strong>Collapse Home after pointer leaves</strong><small>How long Home stays expanded when you move away.</small></div>
        <select aria-label="Collapse Home after pointer leaves" value={collapseDelaySeconds} onChange={event => {
          const seconds = Number(event.target.value);
          saveCollapseDelaySeconds(seconds);
          setCollapseDelaySeconds(seconds);
        }}>
          <option value={5}>5 seconds</option><option value={10}>10 seconds</option>
          <option value={30}>30 seconds</option><option value={60}>1 minute</option>
        </select>
      </div>
      {mouseControlError && <AppModal title="Notch setting unavailable" message={mouseControlError} onClose={() => setMouseControlError("")} />}
    </section>
    <section className="settings-section" aria-labelledby="startup-settings-title">
      <h2 id="startup-settings-title">Startup</h2>
      <label className="settings-switch-row"><span>Start NEAR when I sign in to Windows</span>
        <input type="checkbox" checked={startAtLogin} disabled={!isTauri()} onChange={async event => {
          const enabled = event.target.checked;
          setStartupError("");
          try {
            await invoke("set_start_at_login", { enabled });
            setStartAtLogin(enabled);
          } catch (error) {
            setStartupError(String(error));
          }
        }} />
      </label>
      <span className="settings-hint">NEAR starts automatically in the background after you sign in.</span>
      {startupError && <p className="notes-error" role="alert">Could not update startup setting: {startupError}</p>}
    </section>
    <section className="settings-section" aria-labelledby="appearance-settings-title">
      <h2 id="appearance-settings-title">Appearance</h2>
      <div className="settings-field">
        <span id="settings-theme-label">Theme</span>
        <div className="settings-theme-choice" role="group" aria-labelledby="settings-theme-label">
          {(["dark", "light"] as const).map(choice => <button key={choice} type="button" aria-pressed={theme === choice} onClick={() => {
            setTheme(choice);
            updateTheme(choice);
          }}>{choice === "dark" ? "Dark" : "Light"}</button>)}
        </div>
      </div>
      <label className="settings-switch-row"><span>Reduce motion</span>
        <input type="checkbox" checked={reducedMotion} onChange={event => {
          setReducedMotion(event.target.checked);
          updateReducedMotion(event.target.checked);
        }} />
      </label>
    </section>
    <section className="settings-section" aria-labelledby="reminder-settings-title">
      <h2 id="reminder-settings-title">Event reminders</h2>
      <p>NEAR only reminds you about upcoming events. Past events are ignored.</p>
      <label>Repeat reminder every
        <select value={preferences.repeatMinutes} onChange={event => update({ repeatMinutes: Number(event.target.value) })}>
          <option value={1}>1 minute</option><option value={3}>3 minutes</option><option value={5}>5 minutes</option><option value={10}>10 minutes</option><option value={15}>15 minutes</option>
        </select>
      </label>
      <label>Close the reminder after
        <select value={preferences.closeAfterSeconds} onChange={event => update({ closeAfterSeconds: Number(event.target.value) })}>
          <option value={15}>15 seconds</option><option value={30}>30 seconds</option><option value={45}>45 seconds</option><option value={60}>1 minute</option>
        </select>
      </label>
      <span className="settings-hint">A reminder returns while its event is still upcoming. If NEAR was closed, it checks for due reminders when you open it.</span>
    </section>
    <section className="settings-section" aria-labelledby="voice-settings-title">
      <h2 id="voice-settings-title">NEAR voice</h2>
      <VoicePicker voiceName={voiceName} onVoiceChange={onVoiceChange} />
    </section>
    <section className="settings-section" aria-labelledby="note-dictation-settings-title">
      <h2 id="note-dictation-settings-title">Note dictation</h2>
      <label>Microphone
        <select value={noteMicrophone} onChange={event => {
          saveNoteMicrophone(event.target.value);
          setNoteMicrophone(event.target.value);
        }}>
          <option value="">Windows default microphone</option>
          {noteMicrophone && !microphones.some(device => device.deviceId === noteMicrophone) && <option value={noteMicrophone}>Previously selected microphone (unavailable)</option>}
          {microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}
        </select>
      </label>
      <span className="settings-hint">Used when you dictate a note. Changes apply the next time dictation starts.</span>
    </section>
    <section className="settings-section" aria-labelledby="bible-settings-title">
      <h2 id="bible-settings-title">Offline Bible</h2>
      <BibleSettings />
    </section>
    <section className="settings-section" aria-labelledby="about-settings-title">
      <h2 id="about-settings-title">About NEAR</h2>
      <p className="settings-detail"><span>Version</span><strong>{version}</strong></p>
    </section>
    <section className="settings-section" aria-labelledby="exit-settings-title">
      <h2 id="exit-settings-title">Shutdown</h2>
      <p>NEAR stays running in the background when you close this window.</p>
      <div className="settings-actions">
        <button className="settings-danger-action" type="button" onClick={() => setConfirmExit(true)}>Exit NEAR</button>
      </div>
    </section>
    {confirmExit && <AppModal title="Exit NEAR?" message="This will stop NEAR and hide the notch until you open the app again." confirmLabel="Exit NEAR" danger onConfirm={() => void invoke("exit_near")} onClose={() => setConfirmExit(false)} />}
  </main>;
}
