import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { COLLAPSED, EXPANDED, notchGeometry } from "../components/notchGeometry";

// One worker owns all native writes. A reversal changes its destination without
// starting a competing loop or resetting its position and velocity.
export function useNotchWindow() {
  const native = isTauri();
  const [previewSize, setPreviewSize] = useState(COLLAPSED);
  const [expanded, setExpanded] = useState(false);
  const motion = useRef({
    target: 0,
    position: native ? notchGeometry(window.innerWidth, window.innerHeight).progress : 0,
    velocity: 0,
    focus: false,
    running: false,
    generation: 0,
  });

  useEffect(() => () => {
    motion.current.generation += 1;
    motion.current.running = false;
  }, []);

  const resizeNotch = useCallback((open: boolean, takeFocus = open) => {
    const state = motion.current;
    const target = open ? 1 : 0;
    if (state.target === target && (state.running || state.position === target)) return;
    state.target = target;
    setExpanded(open);
    state.focus = takeFocus;
    if (state.running) return;
    state.running = true;
    const generation = state.generation;

    void (async () => {
      const appWindow = native ? getCurrentWindow() : null;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let previousTime = performance.now();
      let appliedFocus: boolean | undefined;
      try {
        while (generation === state.generation) {
          const time = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
          if (generation !== state.generation) return;
          if (appWindow && appliedFocus !== state.focus) {
            appliedFocus = state.focus;
            await appWindow.setFocusable(appliedFocus);
            if (generation !== state.generation) return;
          }

          // Analytic critically damped spring: time based, with no overshoot at
          // rest. Preserve velocity when hover/shortcut reverses the motion.
          const dt = Math.min((time - previousTime) / 1000, 0.064);
          previousTime = time;
          const frequency = 15;
          const displacement = state.position - state.target;
          const decay = Math.exp(-frequency * dt);
          const coefficient = state.velocity + frequency * displacement;
          let position = state.target + (displacement + coefficient * dt) * decay;
          state.velocity = (state.velocity - frequency * coefficient * dt) * decay;
          position = Math.max(0, Math.min(1, position));
          const settled = reducedMotion.matches || document.documentElement.dataset.reduceMotion === "true" || (Math.abs(position - state.target) < 0.0008 && Math.abs(state.velocity) < 0.02);
          if (settled) {
            position = state.target;
            state.velocity = 0;
          }
          const size = {
          width: COLLAPSED.width + (EXPANDED.width - COLLAPSED.width) * position,
          height: COLLAPSED.height + (EXPANDED.height - COLLAPSED.height) * position,
          };
          if (native) await invoke("set_notch_bounds", size);
          else setPreviewSize(size);
          state.position = position;
          if (generation !== state.generation) return;
          if (settled && position === state.target) {
            if (state.focus && appWindow) await appWindow.setFocus();
            if (position === state.target) break;
          }
        }
      } catch (error) {
        console.error("Unable to resize the notch", error);
      } finally {
        if (generation === state.generation) state.running = false;
      }
    })();
  }, [native]);

  const toggle = useCallback(() => resizeNotch(motion.current.target === 0), [resizeNotch]);
  return { resizeNotch, toggle, expanded, previewSize: native ? undefined : previewSize };
}
