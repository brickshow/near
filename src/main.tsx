import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyAppearance, MOTION_KEY, THEME_KEY } from "./lib/appearance";

applyAppearance();
window.addEventListener("storage", (event) => {
  if (event.key === THEME_KEY || event.key === MOTION_KEY) applyAppearance();
});
window.addEventListener("focus", applyAppearance);

// Docked panels need a stable opaque canvas before their first React paint.
if (["bible", "notes", "church", "settings", "faith"].includes(new URLSearchParams(location.search).get("window") ?? "")) {
  document.documentElement.classList.add("docked-window");
}


const HomePrototype = import.meta.env.DEV && new URLSearchParams(location.search).has("variant")
  ? React.lazy(() => import("./pages/home/Home.prototype"))
  : null;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {HomePrototype ? <React.Suspense fallback={null}><HomePrototype /></React.Suspense> : <App />}
  </React.StrictMode>,
);
