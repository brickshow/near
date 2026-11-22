import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppModal } from "../../components/AppModal";
import { sendChat, type ChatTurn } from "../../lib/chat";
import {
  createConversation,
  deleteConversation,
  listConversations,
  loadConversation,
  saveConversationMessage,
  type ConversationSummary,
} from "../../lib/conversations";

export function ChatWindow() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingReply, setStreamingReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDialog, setErrorDialog] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ConversationSummary | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activate = useCallback(async (conversation: ConversationSummary) => {
    setActiveId(conversation.id);
    setLoading(true);
    setError("");
    try {
      setHistory(await loadConversation(conversation.id));
    } catch (cause) {
      setError(`Could not load this conversation: ${String(cause)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshConversations = useCallback(async () => {
    const rows = await listConversations();
    setConversations(rows);
    return rows;
  }, []);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        let rows = await listConversations();
        if (rows.length === 0) {
          await createConversation();
          rows = await listConversations();
        }
        if (disposed) return;
        setConversations(rows);
        if (rows[0]) {
          setActiveId(rows[0].id);
          setHistory(await loadConversation(rows[0].id));
        }
      } catch (cause) {
        if (!disposed) setError(`Could not load local conversations: ${String(cause)}`);
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    const panel = messagesRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [history, busy, error, loading, streamingReply]);
  useEffect(() => { if (error) setErrorDialog(error); }, [error]);

  const startNewConversation = async () => {
    if (busy || deletingId) return;
    setError("");
    setLoading(true);
    try {
      const conversation = await createConversation();
      const rows = await refreshConversations();
      setActiveId(conversation.id);
      setHistory([]);
      setConversations(rows);
      inputRef.current?.focus();
    } catch (cause) {
      setError(`Could not create a conversation: ${String(cause)}`);
    } finally {
      setLoading(false);
    }
  };

  const removeConversation = async (conversation: ConversationSummary) => {
    if (busy || deletingId) return;
    setDeletingId(conversation.id);
    setPendingDelete(null);
    setError("");
    try {
      await deleteConversation(conversation.id);
      let rows = await refreshConversations();
      if (rows.length === 0) {
        await createConversation();
        rows = await refreshConversations();
      }
      setConversations(rows);
      if (activeId === conversation.id && rows[0]) {
        setActiveId(rows[0].id);
        setHistory(await loadConversation(rows[0].id));
      }
    } catch (cause) {
      setError(`Could not delete this conversation: ${String(cause)}`);
    } finally {
      setDeletingId("");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = message.trim();
    const conversationId = activeId;
    if (!content || busy || !conversationId) return;
    const userTurn: ChatTurn = { role: "user", content };
    const nextHistory = [...history, userTurn];
    setHistory(nextHistory);
    setMessage("");
    setError("");
    setStreamingReply("");
    setBusy(true);
    try {
      await saveConversationMessage(conversationId, userTurn);
      await refreshConversations();
      const response = await sendChat(nextHistory, (delta) => {
        setStreamingReply((current) => current + delta);
      });
      const assistantTurn: ChatTurn = { role: "assistant", content: response };
      await saveConversationMessage(conversationId, assistantTurn);
      setHistory([...nextHistory, assistantTurn]);
      setStreamingReply("");
      await refreshConversations();
    } catch (cause) {
      setStreamingReply("");
      setError(`NEAR could not finish the reply. Your message is kept locally. ${String(cause)}`);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const activeConversation = conversations.find((conversation) => conversation.id === activeId);

  return <><main className="flex h-full min-h-0 flex-col bg-[#08131d] font-sans text-[#eef4fa]">
    <header className="flex h-[58px] shrink-0 items-center gap-3 border-b border-white/[0.08] px-5" data-tauri-drag-region>
      <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-[#42dce9]/50 bg-[#102533]" aria-hidden="true"><img src="/appicon.png" alt="" className="h-full w-full object-cover" /></span>
      <div className="min-w-0 flex-1" data-tauri-drag-region>
        <h1 className="m-0 text-[13px] font-semibold text-[#eef4fa]">Chat with NEAR</h1>
        <p className="m-0 mt-0.5 truncate text-[10px] text-[#8fa5b6]">{activeConversation?.title ?? "Saved on this device"}</p>
      </div>
      <button type="button" className="grid h-8 w-8 cursor-pointer place-items-center rounded-md border border-white/[0.08] bg-white/[0.03] text-[#aabcca] hover:bg-white/[0.09] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#68dfd0]" aria-label="Close chat" onClick={() => void getCurrentWindow().close()}><CloseIcon /></button>
    </header>

    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[210px] shrink-0 flex-col border-r border-white/[0.08] bg-[#0b1823] p-3 max-[640px]:w-[164px] max-[640px]:p-2" aria-label="Conversations">
        <button type="button" className="mb-3 inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#49dceb]/30 bg-[#102b36] px-3 text-[11px] font-medium text-[#83e8ec] hover:bg-[#153944] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#68dfd0] disabled:opacity-40" onClick={() => void startNewConversation()} disabled={busy || loading || Boolean(deletingId)}><PlusIcon />New conversation</button>
        
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-color:rgba(140,170,196,0.25)_transparent] [scrollbar-width:thin]">
          {conversations.map((conversation) => <div key={conversation.id} className={`group flex min-w-0 items-center gap-1 rounded-lg border px-1 ${conversation.id === activeId ? "border-white/[0.08] bg-white/[0.06]" : "border-transparent hover:bg-white/[0.035]"}`}>
            <button type="button" className="min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent px-2 py-2 text-left text-[10px] text-[#c7d3dc] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#68dfd0] disabled:opacity-40" title={conversation.title} onClick={() => void activate(conversation)} disabled={busy || loading || Boolean(deletingId)}>{conversation.title}</button>
            <button type="button" className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-[#718695] opacity-70 hover:bg-[#482b2b] hover:text-[#ff9c8f] focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#ff9c8f] group-hover:opacity-100 disabled:cursor-wait" aria-label={`Delete ${conversation.title}`} title="Delete conversation" onClick={() => setPendingDelete(conversation)} disabled={busy || loading || Boolean(deletingId)}><TrashIcon /></button>
          </div>)}
          {!loading && conversations.length === 0 && <p className="px-1 text-[10px] text-[#8193a1]">No saved conversations.</p>}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div ref={messagesRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 [scrollbar-color:rgba(140,170,196,0.35)_transparent] [scrollbar-width:thin] max-[640px]:px-3" aria-live="polite">
          {loading && <p className="m-auto text-[11px] text-[#8fa5b6]">Loading your conversations…</p>}
          {!loading && history.length === 0 && <div className="m-auto max-w-[420px] px-4 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-[#42dce9]/35 bg-[#102533]" aria-hidden="true"><img src="/appicon.png" alt="" className="h-full w-full object-cover" /></div>
            <h2 className="m-0 text-[16px] font-medium text-[#e7eff5]">What’s on your heart?</h2>
            <p className="mb-0 mt-2 text-[12px] leading-relaxed text-[#9aabba]">Share what you’re carrying. NEAR is here to listen and reflect with you through Scripture.</p>
          </div>}
          {history.map((turn, index) => <div key={`${index}-${turn.role}`} className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
            <p className={`m-0 max-w-[min(82%,620px)] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${turn.role === "user" ? "rounded-br-md bg-[#183b48] text-[#e7f4f5]" : "rounded-bl-md border border-white/[0.07] bg-[#111f2b] text-[#dfe8ee]"}`}>{turn.content}</p>
          </div>)}
          {streamingReply && <div className="flex justify-start"><p className="m-0 max-w-[min(82%,620px)] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-white/[0.07] bg-[#111f2b] px-4 py-3 text-[13px] leading-relaxed text-[#dfe8ee]" aria-label="NEAR is typing">{streamingReply}<span className="ml-1 inline-block h-3 w-[2px] animate-pulse bg-[#68dfd0] align-middle" aria-hidden="true" /></p></div>}
          {busy && !streamingReply && <div className="flex items-center gap-2 text-[11px] text-[#68dce1]" role="status"><span className="flex gap-1" aria-hidden="true"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" /></span>NEAR is thinking</div>}
        </div>

        <form className="shrink-0 border-t border-white/[0.08] px-5 py-4 max-[640px]:px-3" onSubmit={(event) => void submit(event)}>
          <div className="flex items-end gap-2 rounded-2xl border border-white/[0.1] bg-[#111f2b] p-2 focus-within:border-[#49dceb]/60">
            <textarea ref={inputRef} className="max-h-36 min-h-10 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-[13px] leading-relaxed text-[#edf4f6] outline-none placeholder:text-[#8799a8]" placeholder="Write a message…" aria-label="Write a message" rows={1} value={message} disabled={busy || loading || !activeId} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
            <button type="submit" className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl border-0 bg-[#49dceb] text-[#052b3a] transition hover:bg-[#75eaf4] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message" disabled={busy || loading || !message.trim()}><SendIcon /></button>
          </div>
          <p className="mb-0 mt-2 text-center text-[10px] text-[#748897]">Saved on this device · Enter to send · Shift + Enter for a new line</p>
        </form>
      </section>
    </div>
  </main>
    {pendingDelete && <AppModal title="Delete conversation?" message={`“${pendingDelete.title}” and its messages will be removed from this device.`} confirmLabel="Delete conversation" danger onConfirm={() => void removeConversation(pendingDelete)} onClose={() => setPendingDelete(null)} />}
    {errorDialog && <AppModal title="Chat error" message={errorDialog} onClose={() => setErrorDialog("")} />}
  </>;
}

function CloseIcon() { return <svg className="h-4 w-4 fill-none stroke-current [stroke-linecap:round] [stroke-width:1.5]" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>; }
function PlusIcon() { return <svg className="h-3.5 w-3.5 fill-none stroke-current [stroke-linecap:round] [stroke-width:1.6]" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>; }
function TrashIcon() { return <svg className="h-3.5 w-3.5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.35]" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4h11M6 4V2.5h4V4m2 0-.6 9H4.6L4 4m2.5 2.5v4m3-4v4" /></svg>; }
function SendIcon() { return <svg className="h-4 w-4 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]" viewBox="0 0 20 20" aria-hidden="true"><path d="m3 3 14 7-14 7 2.5-7L3 3Z" /><path d="M5.5 10H17" /></svg>; }
