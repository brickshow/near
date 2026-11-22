export type Theme = "dark" | "light";
export const THEME_KEY = "near.appearance.theme";
export const MOTION_KEY = "near.appearance.reduce-motion";

export function getTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}

export function applyAppearance() {
  document.documentElement.dataset.theme = getTheme();
  document.documentElement.dataset.reduceMotion = localStorage.getItem(MOTION_KEY) === "true" ? "true" : "false";
}

export function setTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyAppearance();
}

export function setReducedMotion(enabled: boolean) {
  localStorage.setItem(MOTION_KEY, String(enabled));
  applyAppearance();
}
