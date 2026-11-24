export type HomeSection = "Home" | "Bible" | "Journey" | "Notes" | "Music" | "Church" | "Settings";
const SECTIONS: HomeSection[] = ["Home", "Bible", "Journey", "Notes", "Music", "Church"];

type HomeNavigationProps = { active: HomeSection; onNavigate: (section: HomeSection) => void };

export function HomeNavigation({ active, onNavigate }: HomeNavigationProps) {
  return <nav className="home-nav" aria-label="NEAR sections">
    {SECTIONS.map((section) => <button key={section} className="home-nav-item" aria-current={active === section ? "page" : undefined} onClick={() => onNavigate(section)}><TabIcon section={section} />{section}</button>)}
  </nav>;
}

function TabIcon({ section }: { section: HomeSection }) {
  const cls = "h-3.5 w-3.5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.4]";
  if (section === "Home") return <svg className={cls} viewBox="0 0 18 18" aria-hidden="true"><path d="m2 8 7-6 7 6v8h-5v-5H7v5H2z"/></svg>;
  if (section === "Notes") return <svg className={cls} viewBox="0 0 18 18" aria-hidden="true"><path d="M4 2h7l4 4v10H4zM11 2v4h4M7 10h5m-5 3h5"/></svg>;
  if (section === "Bible") return <svg className={cls} viewBox="0 0 18 18" aria-hidden="true"><path d="M2 4c2.5-1 4.5-.5 7 1v11c-2.5-1.5-4.5-2-7-1zm14 0c-2.5-1-4.5-.5-7 1v11c2.5-1.5 4.5-2 7-1z"/></svg>;
  if (section === "Journey") return <svg className={cls} viewBox="0 0 18 18" aria-hidden="true"><path d="M9 16V5m0 6C5 11 3 9 3 5c4 0 6 2 6 6Zm0-2c0-4 2-6 6-6 0 4-2 6-6 6Z"/></svg>;
  if (section === "Music") return <svg className={cls} viewBox="0 0 18 18" aria-hidden="true"><path d="M11 12V3l5-1v9M11 5l5-1M11 12c0 1-1 2-2 2s-2-.5-2-1.5S8 11 9 11s2 0 2 1ZM16 11c0 1-1 2-2 2s-2-.5-2-1.5 1-1.5 2-1.5 2 0 2 1Z"/></svg>;
  if (section === "Church") return <svg className={cls} viewBox="0 0 18 18" aria-hidden="true"><rect x="2" y="4" width="14" height="12" rx="1"/><path d="M5 2v4m8-4v4M2 8h14"/></svg>;
  return <svg className={cls} viewBox="0 0 18 18" aria-hidden="true"><path d="M7 2h4l.6 2.1 1.5.9 2-.5 2 3.5-1.5 1.5v1.7l1.5 1.5-2 3.5-2-.5-1.5.9L11 18H7l-.6-2.1-1.5-.9-2 .5-2-3.5L2.4 10.5V8.8L.9 7.3l2-3.5 2 .5 1.5-.9z" transform="translate(1 -1) scale(.9)"/><circle cx="9" cy="9" r="2.4"/></svg>;
}
