// Throwaway development control; remove once the Home design is selected.
import { useEffect } from "react";

export function PrototypeSwitcher({ current, onChange }: { current: string; onChange: (key: string) => void }) {
  const keys = ["A", "B", "C"];
  const names = ["Balanced row", "Verse first", "Assistant first"];
  const index = keys.indexOf(current);
  function cycle(direction: number) { onChange(keys[(index + direction + keys.length) % keys.length]); }
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        cycle(event.key === "ArrowLeft" ? -1 : 1);
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });
  if (!import.meta.env.DEV) return null;
  return <div className="prototype-switcher" aria-label="Prototype variants">
    <button onClick={() => cycle(-1)} aria-label="Previous variant">←</button>
    <span aria-live="polite">{current} · {names[index]}</span>
    <button onClick={() => cycle(1)} aria-label="Next variant">→</button>
  </div>;
}
