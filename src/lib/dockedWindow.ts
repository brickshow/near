import { isTauri } from "@tauri-apps/api/core";
import { primaryMonitor, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";
import { getAllWebviewWindows, WebviewWindow } from "@tauri-apps/api/webviewWindow";

export async function openDockedWindow(kind: "bible" | "notes" | "church" | "settings" | "faith", onWindowError?: (message: string) => void, query = ""): Promise<boolean> {
  if (!isTauri()) { const width = 460; const height = kind === "faith" ? Math.min(screen.availHeight, 1536) : 800; window.open(`/?window=${kind}${query}`, "near-panel", `popup,width=${width},height=${height}`); return false; }
  // Use the same anchor for every panel. currentMonitor() depends on which
  // webview opened the panel, so launching from Faith Journey could place
  // Bible/Notes/Church on a different display than launching from the main UI.
  const monitor = await primaryMonitor();
  const scale = monitor?.scaleFactor ?? 1;
  const area = monitor?.workArea;
  const preferredWidth = 460;
  const width = Math.min(preferredWidth, area ? area.size.width / scale : preferredWidth);
  const height = area ? area.size.height / scale : 800;
  const x = area ? (area.position.x + area.size.width) / scale - width : 0;
  const y = area ? area.position.y / scale : 0;
  const panelLabels = new Set(["near-bible", "near-notes", "near-church", "near-settings", "near-faith"]);
  const windows = await getAllWebviewWindows();
  const existing = windows.find(w => w.label === `near-${kind}`);
  const hideOtherPanels = () => Promise.all(windows.filter(w => panelLabels.has(w.label) && w.label !== `near-${kind}`).map(w => w.hide()));
  if (existing) {
    await existing.setDecorations(false);
    await existing.setShadow(false);
    await existing.setResizable(false);
    await existing.setAlwaysOnTop(true);
    // Linux window managers may ignore configure requests for hidden windows.
    // Show the retained panel first, then move it to the chosen display edge.
    await existing.show();
    await new Promise(resolve => window.setTimeout(resolve, 100));
    await existing.setSize(new LogicalSize(width, height));
    await existing.setPosition(new LogicalPosition(x, y));
    await existing.setFocus(); window.setTimeout(() => { void hideOtherPanels(); }, 120); return true;
  }
  const title = { bible: "Holy Bible", notes: "Notes", church: "Church Calendar", settings: "Settings", faith: "Faith Journey" }[kind];
  const panel = new WebviewWindow(`near-${kind}`, {
    url: `/?window=${kind}${query}`, title: `NEAR - ${title}`, width, height, x, y,
    decorations: false, transparent: false, shadow: false, backgroundColor: "#08131d", resizable: false, alwaysOnTop: true,
  });
  panel.once("tauri://created", () => { void hideOtherPanels(); });
  panel.once("tauri://error", ({ payload }) => onWindowError?.(`Could not open ${title}: ${String(payload)}`));
  return false;
}