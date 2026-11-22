export const COLLAPSE_DELAY_KEY = "near.notch.collapseDelaySeconds";
export const MOUSE_CONTROL_KEY = "near.notch.mouseControl";
export const NOTCH_AUTO_HIDE_KEY = "near.notch.autoHideSeconds";
export const DEFAULT_COLLAPSE_DELAY_SECONDS = 5;
export const DEFAULT_NOTCH_AUTO_HIDE_SECONDS = 15;

export function loadNotchAutoHideSeconds(): number {
  const saved = Number(localStorage.getItem(NOTCH_AUTO_HIDE_KEY));
  return [0, 5, 10, 15, 30, 60].includes(saved) ? saved : DEFAULT_NOTCH_AUTO_HIDE_SECONDS;
}

export function saveNotchAutoHideSeconds(seconds: number): void {
  if (![0, 5, 10, 15, 30, 60].includes(seconds)) return;
  localStorage.setItem(NOTCH_AUTO_HIDE_KEY, String(seconds));
}

export function loadMouseControl(): boolean {
  return localStorage.getItem(MOUSE_CONTROL_KEY) !== "false";
}

export function saveMouseControl(enabled: boolean): void {
  localStorage.setItem(MOUSE_CONTROL_KEY, String(enabled));
}

export function loadCollapseDelaySeconds(): number {
  const saved = Number(localStorage.getItem(COLLAPSE_DELAY_KEY));
  return [5, 10, 30, 60].includes(saved) ? saved : DEFAULT_COLLAPSE_DELAY_SECONDS;
}

export function saveCollapseDelaySeconds(seconds: number): void {
  if (![5, 10, 30, 60].includes(seconds)) return;
  localStorage.setItem(COLLAPSE_DELAY_KEY, String(seconds));
}
