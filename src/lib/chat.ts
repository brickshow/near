import { openUrl } from "@tauri-apps/plugin-opener";
import { createMusicCommands } from "./musicCommands";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type ChatTurn = { role: "user" | "assistant"; content: string };
type ChatDelta = { requestId: string; delta: string };
const CONTEXT_TURN_LIMIT = 10;

const music = createMusicCommands(
  query => invoke<{ url: string; matched: boolean; title?: string | null }>("resolve_youtube_music", { query }),
  url => openUrl(url),
  title => invoke("media_play_youtube", { title }),
  query => invoke<boolean>("media_play_spotify", { query }),
);

export const prepareChat = () => invoke<void>("prepare_chatgpt");

function formatNearAnswer(text: string): string {
  return text
    .replace(/\*+/gu, "")
    .replace(/^#{1,6}\s+/gmu, "")
    .replace(/`{1,3}/gu, "")
    .replace(/^\s*[-+]\s+/gmu, "")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export async function sendChat(
  history: ChatTurn[],
  onDelta?: (delta: string) => void,
  options: { mode?: "chat" | "voice" } = {},
): Promise<string> {
  const latest = history[history.length - 1];
  if (latest?.role === "user") {
    const actionReply = await music(latest.content);
    if (actionReply !== null) { onDelta?.(actionReply); return actionReply; }
  }
  const requestId = crypto.randomUUID();
  let received = "";
  const unlisten = await listen<ChatDelta>("near://chatgpt-delta", ({ payload }) => {
    if (payload.requestId === requestId) {
      received += payload.delta;
      // Preserve whitespace at chunk boundaries. Formatting each streamed
      // delta trims spaces that belong between adjacent chunks.
      onDelta?.(payload.delta);
    }
  });
  try {
    const reply = await invoke<string>("chatgpt_reply", {
      history: history.slice(-CONTEXT_TURN_LIMIT),
      requestId,
      mode: options.mode ?? "chat",
    });
    if (onDelta && reply.startsWith(received)) onDelta(reply.slice(received.length));
    return formatNearAnswer(reply);
  } finally {
    unlisten();
  }
}
