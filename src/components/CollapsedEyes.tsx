import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { loadMouseControl, loadNotchAutoHideSeconds } from "../lib/notchPreferences";

const IDLE_MS = 5_000;

export function CollapsedEyes({ active, onClick }: { active: boolean; onClick: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [asleep, setAsleep] = useState(false);
  const [mouseControl, setMouseControl] = useState(loadMouseControl);
  const mouseControlRef = useRef(mouseControl);
  const idleTimerRef = useRef<number | undefined>(undefined);

  const showActivity = useCallback((x: number, y: number) => {
    setGaze({ x: Math.tanh(x / 250) * 3, y: Math.tanh(y / 160) * 2 });
    setAsleep(false);
    if (idleTimerRef.current !== undefined) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setAsleep(true), IDLE_MS);
  }, []);

  useEffect(() => { mouseControlRef.current = mouseControl; }, [mouseControl]);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    const unlisten: Array<() => void> = [];
    const appWindow = getCurrentWindow();
    void invoke("set_notch_mouse_control", { enabled: mouseControlRef.current }).catch(error => {
      console.warn("Could not apply NEAR mouse control setting", error);
    });
    void invoke("set_notch_auto_hide_seconds", { seconds: loadNotchAutoHideSeconds() }).catch(error => {
      console.warn("Could not apply NEAR auto-hide setting", error);
    });
    void listen<boolean>("near://notch-mouse-control-changed", event => {
      mouseControlRef.current = event.payload;
      setMouseControl(event.payload);
    }).then(stop => { if (active) unlisten.push(stop); else stop(); });
    void listen<{ x: number; y: number }>("near://notch-cursor-move", event => {
      if (!active || !mouseControlRef.current) return;
      const button = buttonRef.current;
      if (!button) return;
      void appWindow.outerPosition().then(origin => {
        if (!active || !mouseControlRef.current) return;
        const bounds = button.getBoundingClientRect();
        const scale = window.devicePixelRatio;
        showActivity(
          event.payload.x - origin.x - (bounds.left + bounds.width / 2) * scale,
          event.payload.y - origin.y - (bounds.top + bounds.height / 2) * scale,
        );
      }).catch(() => {});
    }).then(stop => { if (active) unlisten.push(stop); else stop(); });
    return () => {
      active = false;
      unlisten.forEach(stop => stop());
    };
  }, [showActivity]);

  useEffect(() => {
    if (!active) return;

    setAsleep(false);
    idleTimerRef.current = window.setTimeout(() => setAsleep(true), IDLE_MS);

    const followPointer = (event: PointerEvent) => {
      if (!mouseControlRef.current) return;
      const button = buttonRef.current;
      if (!button) return;

      const bounds = button.getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      showActivity(event.clientX - centerX, event.clientY - centerY);
    };

    window.addEventListener("pointermove", followPointer, { passive: true });
    return () => {
      window.removeEventListener("pointermove", followPointer);
      if (idleTimerRef.current !== undefined) window.clearTimeout(idleTimerRef.current);
    };
  }, [active, showActivity]);

  return (
    <button
      ref={buttonRef}
      className="near-collapsed-eyes-button"
      aria-label="Expand NEAR"
      onClick={onClick}
    >
      <span className={`near-collapsed-eyes${asleep ? " is-asleep" : ""}`} aria-hidden="true">
        {[0, 1].map(eye => (
          <span
            className="near-collapsed-eye"
            key={eye}
            style={{ transform: `translate(${gaze.x}px, ${gaze.y}px)` }}
          >
            <span className="near-collapsed-pupil" />
          </span>
        ))}
      </span>
    </button>
  );
}
