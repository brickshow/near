import { useState } from "react";
import { buttonPrimary, buttonSecondary } from "../../components/buttonClasses";
import { ConversationPanel } from "./ConversationPanel";

type ConversationHistoryPageProps = { onBack: () => void; onOpen: () => void; onNew: () => void; onHome: () => void };

export function ConversationHistoryPage({ onBack, onOpen, onNew, onHome }: ConversationHistoryPageProps) {
  const [search, setSearch] = useState("");
  const rows = ["Evening reflection", "Prayer reminder"].filter((item) => item.toLowerCase().includes(search.toLowerCase()));
  return <ConversationPanel title="Recent conversations" onHome={onHome}>
    <div className="flex flex-col gap-1.5">
      <input className="h-[27px] rounded-full border border-[#8294a5]/20 bg-[#182532] px-3 text-[9px] text-[#e3ebf1] outline-none placeholder:text-[#99a6b3] focus:border-[#44dbea]" placeholder="⌕  Search conversations…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search conversations" />
      {rows.map((item, index) => <button key={item} className="flex h-[25px] cursor-pointer items-center gap-2 rounded-md border-0 bg-white/[0.055] px-2 text-left text-[9px] text-[#d5dee7] hover:bg-white/[0.09]" onClick={onOpen}><span className="text-[#bac8d4]">▱</span><span className="flex-1">{item}</span><span className="text-[#98a5b2]">{index === 0 ? "Today" : "Yesterday"}</span><span aria-hidden="true">›</span></button>)}
      {rows.length === 0 && <p className="m-0 px-2 text-[9px] text-[#9eabb8]">No conversations found.</p>}
      <div className="flex justify-between gap-2">
        <button className={`${buttonSecondary} !h-[28px]`} onClick={onBack}>← &nbsp;Back</button>
        <button className={`${buttonPrimary} !h-[28px]`} onClick={onNew}>＋ New conversation</button>
      </div>
    </div>
  </ConversationPanel>;
}
