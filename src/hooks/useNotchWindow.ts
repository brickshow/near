import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { COLLAPSED, EXPANDED } from "../components/notchGeometry";

const nextFrame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));

// Keep the native window stationary while the shell animates inside it.
export function useNotchWindow() {
  const native = isTauri();
  const [size, setSize] = useState(COLLAPSED);
  const [expanded, setExpanded] = useState(false);
  const [settledOpen, setSettledOpen] = useState(false);
  const motion = useRef({
    target: 0,
    settledTarget: undefined as number | undefined,
    position: 0,
    velocity: 0,
    windowOpen: false,
    expandedSize: EXPANDED,
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
    if (state.target === target && (state.running || state.settledTarget === target)) return;
    state.target = target;
    state.settledTarget = undefined;
    setExpanded(open);
    setSettledOpen(false);
    state.focus = takeFocus;
    if (state.running) return;
    state.running = true;
    const generation = state.generation;

    void (async () => {
      const appWindow = native ? getCurrentWindow() : null;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let previousTime = performance.now();
      try {
        while (generation === state.generation) {
          const time = await nextFrame();
          if (generation !== state.generation) return;

          if (native && state.target === 1 && !state.windowOpen) {
            state.expandedSize = await invoke<typeof EXPANDED>("set_notch_bounds", EXPANDED) ?? EXPANDED;
            state.windowOpen = true;
            previousTime = performance.now();
            continue;
          }

          // Preserve velocity when the user reverses the motion.
          const dt = Math.max(0, Math.min((time - previousTime) / 1000, 0.064));
          previousTime = time;
          const frequency = 18;
          const displacement = state.position - state.target;
          const decay = Math.exp(-frequency * dt);
          const coefficient = state.velocity + frequency * displacement;
          let position = state.target + (displacement + coefficient * dt) * decay;
          state.velocity = (state.velocity - frequency * coefficient * dt) * decay;
          position = Math.max(0, Math.min(1, position));
          const settled = reducedMotion.matches || document.documentElement.dataset.reduceMotion === "true" || (Math.abs(position - state.target) < 0.003 && Math.abs(state.velocity) < 0.04);
          if (settled) {
            position = state.target;
            state.velocity = 0;
          }
          state.position = position;
          setSize({
            width: COLLAPSED.width + (state.expandedSize.width - COLLAPSED.width) * position,
            height: COLLAPSED.height + (state.expandedSize.height - COLLAPSED.height) * position,
          });
          if (!settled) continue;

          if (native && position === 0 && state.windowOpen) {
            // Paint the collapsed shell before reducing its native hit area.
            await nextFrame();
            if (generation !== state.generation) return;
            if (state.target !== position) continue;
            await invoke("set_notch_bounds", COLLAPSED);
            state.windowOpen = false;
          }
          if (generation !== state.generation) return;
          if (state.target !== position) continue;
          if (appWindow) {
            await appWindow.setFocusable(state.focus).catch(error => console.warn("Unable to change notch focusability", error));
            if (generation !== state.generation) return;
            if (state.target === position && state.focus) {
              await appWindow.setFocus().catch(error => console.warn("Unable to focus the notch", error));
            }
          }
          if (generation !== state.generation) return;
          if (state.target === position) {
            state.settledTarget = position;
            setSettledOpen(position === 1);
            break;
          }
          previousTime = performance.now();
        }
      } catch (error) {
        console.error("Unable to resize the notch", error);
      } finally {
        if (generation === state.generation) state.running = false;
      }
    })();
  }, [native]);

  const toggle = useCallback(() => resizeNotch(motion.current.target === 0), [resizeNotch]);
  return { resizeNotch, toggle, expanded, settledOpen, size };
}
