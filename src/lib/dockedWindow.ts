import { isTauri } from "@tauri-apps/api/core";
import { currentMonitor, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";
import { getAllWebviewWindows, WebviewWindow } from "@tauri-apps/api/webviewWindow";

export async function openDockedWindow(kind: "bible" | "notes" | "church" | "settings", onWindowError?: (message: string) => void) {
  if (!isTauri()) { window.open(`/?window=${kind}`, `near-${kind}`, "popup,width=460,height=800"); return; }
  const monitor = await currentMonitor();
  const scale = monitor?.scaleFactor ?? 1;
  const area = monitor?.workArea;
  const width = Math.min(460, area ? area.size.width / scale : 460);
  const height = area ? area.size.height / scale : 800;
  const x = area ? (area.position.x + area.size.width) / scale - width : 0;
  const y = area ? area.position.y / scale : 0;
  const existing = (await getAllWebviewWindows()).find(w => w.label === `near-${kind}`);
  if (existing) {
    await existing.setIcon("/appicon.png");
    await existing.setDecorations(false);
    await existing.setShadow(false);
    await existing.setBackgroundColor("#08131d");
    await existing.setResizable(false);
    await existing.setAlwaysOnTop(true);
    await existing.setSize(new LogicalSize(width, height));
    await existing.setPosition(new LogicalPosition(x, y));
    await existing.show(); await existing.setFocus(); return;
  }
  const title = { bible: "Holy Bible", notes: "Notes", church: "Church Calendar", settings: "Settings" }[kind];
  const panel = new WebviewWindow(`near-${kind}`, {
    url: `/?window=${kind}`, title: `NEAR - ${title}`, width, height, x, y,
    decorations: false, transparent: false, shadow: false, backgroundColor: "#08131d", resizable: false, alwaysOnTop: true,
  });
  void panel.setIcon("/appicon.png").catch(error => console.error(`Could not set ${title} window icon`, error));
  panel.once("tauri://error", ({ payload }) => onWindowError?.(`Could not open ${title}: ${String(payload)}`));
}
