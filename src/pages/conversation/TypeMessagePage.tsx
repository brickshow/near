import { useState, type FormEvent } from "react";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";
import { ConversationPanel } from "./ConversationPanel";
import type { ChatTurn } from "../../lib/chat";
type TypeMessagePageProps = { onSend: (history: ChatTurn[]) => Promise<string>; onListen: () => void; onHistory: () => void; onHome: () => void };

export function TypeMessagePage({ onSend, onListen, onHistory, onHome }: TypeMessagePageProps) {
  const [history, setHistory] = useState<ChatTurn[]>([
    { role: "user", content: "I feel overwhelmed." },
    { role: "assistant", content: "Would you like to pause, talk, or pray?" },
  ]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = message.trim();
    if (!content || busy) return;
    const nextHistory = [...history, { role: "user" as const, content }];
    setHistory(nextHistory);
    setMessage("");
    setError("");
    setBusy(true);
    try {
      const response = await onSend(nextHistory);
      setHistory([...nextHistory, { role: "assistant", content: response }]);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };

  return <ConversationPanel title="Chat with NEAR" onHome={onHome}>
    <div className="flex min-h-0 flex-col gap-1.5">
      <div className="flex max-h-[78px] flex-col gap-1.5 overflow-y-auto pr-1 text-[9px]">
        {history.map((turn, index) => <div key={`${index}-${turn.role}`} className="flex items-start gap-1.5">
          <span className={`shrink-0 rounded-full px-2 py-1 ${turn.role === "assistant" ? "bg-[#102533] text-[#44d8ec]" : "bg-[#1b2936] text-[#cdd8e2]"}`}>{turn.role === "assistant" ? "◉ NEAR" : "You"}</span>
          <span className="rounded-lg bg-[#1b2936] px-2.5 py-1.5 text-[#e0e8ee]">{turn.content}</span>
        </div>)}
        {busy && <div className="px-2 text-[9px] text-[#44d8ec]">NEAR is thinking…</div>}
      </div>
      {error && <p role="alert" className="max-h-8 overflow-y-auto text-[9px] text-[#ff9c8f]">{error}</p>}
      <form className="flex items-center gap-1.5" onSubmit={(event) => void submit(event)}>
        <button type="button" className="grid h-[30px] w-[30px] shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[#1b2936] text-[#dce6ed]" aria-label="Use voice input" onClick={onListen}><MicIcon /></button>
        <input className="h-[30px] min-w-0 flex-1 rounded-full border border-[#8294a5]/20 bg-[#182532] px-3 text-[9px] text-[#e3ebf1] outline-none placeholder:text-[#99a6b3] focus:border-[#44dbea]" placeholder="Type a message" value={message} onChange={(event) => setMessage(event.target.value)} aria-label="Type a message" disabled={busy} />
        <button className={`${buttonPrimary} !h-[30px] !min-w-[62px] !px-2`} type="submit" disabled={busy || !message.trim()}><SendIcon />{busy ? "Wait" : "Send"}</button>
        <button className={`${buttonSecondary} !h-[30px] !min-w-0 !px-2`} type="button" onClick={onHistory}>◷ &nbsp;History</button>
      </form>
    </div>
  </ConversationPanel>;
}

function MicIcon() { return <svg className="h-3.5 w-3.5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]" viewBox="0 0 18 18" aria-hidden="true"><rect x="6" y="2" width="6" height="10" rx="3"/><path d="M3.5 9a5.5 5.5 0 0 0 11 0M9 14.5V17m-3 0h6"/></svg>; }
function SendIcon() { return <svg className="h-3.5 w-3.5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.4]" viewBox="0 0 18 18" aria-hidden="true"><path d="m2 2 14 7-14 7 2.5-7L2 2Z"/><path d="M4.5 9H16"/></svg>; }
