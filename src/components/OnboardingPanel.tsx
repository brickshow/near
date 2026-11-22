import type { ReactNode } from "react";
import { ParticleOrb } from "./ParticleOrb";

export type PanelIcon = "orb" | "document" | "book" | "bell" | "quiet" | "robot" | "success" | "warning" | "loading" | "microphone" | "download" | "settings" | "disconnected" | "limit";
type OnboardingPanelProps = { icon: PanelIcon; title: string; description: string; children: ReactNode; frameOrb?: boolean; footer?: ReactNode; hideText?: boolean; hideIcon?: boolean };

export function OnboardingPanel({ icon, title, description, children, frameOrb = false, footer, hideText = false, hideIcon = false }: OnboardingPanelProps) {
  const iconStyle = {
    orb: "",
    document: "border-[#77afd5]/[0.28]",
    book: "border-[#77afd5]/[0.28]",
    bell: "border-[#e6a72e]/[0.55] text-[#f0bf52] shadow-[0_0_14px_rgba(239,177,51,0.14),inset_0_0_12px_rgba(239,177,51,0.07)]",
    quiet: "border-[#9363e8]/[0.6] text-[#b487ff] shadow-[0_0_16px_rgba(145,90,240,0.18),inset_0_0_12px_rgba(145,90,240,0.09)]",
    robot: "border-[#77afd5]/[0.28]",
    success: "border-[#11dba9]/[0.45] text-[#21e2b1] shadow-[0_0_14px_rgba(17,219,169,0.17),inset_0_0_12px_rgba(17,219,169,0.08)]",
    warning: "border-[#ef4d41]/[0.5] text-[#ff6b62] shadow-[0_0_15px_rgba(232,67,55,0.12),inset_0_0_12px_rgba(232,67,55,0.06)]",
    loading: "relative border-transparent",
    microphone: "border-[#77afd5]/[0.28]",
    download: "border-[#77afd5]/[0.28]",
    settings: "border-[#77afd5]/[0.28]",
    disconnected: "border-[#8495a5]/[0.65] text-[#aebbc7] shadow-[0_0_14px_rgba(133,151,168,0.12),inset_0_0_12px_rgba(133,151,168,0.06)]",
    limit: "border-[#8495a5]/[0.65] text-[#c6d0d9] shadow-[0_0_14px_rgba(133,151,168,0.12),inset_0_0_12px_rgba(133,151,168,0.06)]",
  }[icon];
  const actionLayout = icon === "robot" ? "flex-col items-stretch gap-[5px]" : "flex-row items-center gap-2";
  return <section className="flex h-full min-h-[98px] flex-col px-[22px] py-1">
    <div className={`grid min-h-0 flex-1 items-center ${hideIcon ? "grid-cols-1" : "grid-cols-[68px_minmax(0,1fr)] gap-[18px]"}`}>
      {!hideIcon && <div className={`grid h-[62px] w-[62px] place-items-center rounded-full text-[#dce9ee] ${icon === "orb" && !frameOrb ? "border-0 shadow-none" : "border-2 shadow-[0_0_16px_rgba(54,165,207,0.08),inset_0_0_12px_rgba(92,181,229,0.07)]"} ${iconStyle}`} aria-hidden="true"><PanelIconArt icon={icon} /></div>}
      <div className="min-w-0">
        {!hideText && <>
          <h1 className="m-0 text-[18px] font-semibold leading-[1.17] tracking-[-0.025em] text-[#f0f4f9]">{title}</h1>
          <p className="mb-[10px] mt-[3px] max-w-[410px] text-[11px] leading-[1.35] text-[#c0cbd7]">{description}</p>
        </>}
        <div className={`flex ${actionLayout}`}>{children}</div>
      </div>
    </div>
    {footer && <div className="h-[29px] shrink-0">{footer}</div>}
  </section>;
}

function PanelIconArt({ icon }: { icon: PanelIcon }) {
  const svgClass = "h-7 w-7 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.45]";
  if (icon === "orb") return <ParticleOrb className="h-14 w-14" />;
  if (icon === "document") return <svg className={svgClass} viewBox="0 0 28 28"><path d="M7 3.5h9l5 5v16H7zM16 3.5v5h5M10 13h8m-8 4h8m-8 4h5" /></svg>;
  if (icon === "book") return <svg className={svgClass} viewBox="0 0 28 28"><path d="M3 5c4-1.4 7.8-.7 11 1.7V24c-3.2-2.4-7-3.1-11-1.7zm22 0c-4-1.4-7.8-.7-11 1.7V24c3.2-2.4 7-3.1 11-1.7z" /></svg>;
  if (icon === "bell") return <svg className={svgClass} viewBox="0 0 28 28"><path d="M7 18h14l-2-3V11a5 5 0 0 0-10 0v4zm5 4a2 2 0 0 0 4 0"/><path d="M14 3v2"/></svg>;
  if (icon === "quiet") return <svg className={svgClass} viewBox="0 0 28 28"><path d="M21 17.5A10 10 0 0 1 10.5 7 10 10 0 1 0 21 17.5Z"/><path d="M19 4v4m-2-2h4"/></svg>;
  if (icon === "robot") return <svg className={svgClass} viewBox="0 0 32 32"><path d="M16 4v4m-2-4h4M5 13h22v13H5zM11 17h.1m9.8 0h.1M12 22h8M8 9h16"/><circle cx="16" cy="9" r="2"/></svg>;
  if (icon === "microphone") return <svg className={svgClass} viewBox="0 0 28 28"><rect x="10" y="3" width="8" height="15" rx="4"/><path d="M6 13a8 8 0 0 0 16 0M14 21v4m-4 0h8"/></svg>;
  if (icon === "download") return <svg className={svgClass} viewBox="0 0 28 28"><path d="M14 3v15m-6-6 6 6 6-6M4 23h20"/></svg>;
  if (icon === "settings") return <svg className={svgClass} viewBox="0 0 28 28"><path d="M12 3h4l.7 2.7 2.1 1.2 2.6-.7 2 3.5-1.9 1.9v2.5l1.9 1.9-2 3.5-2.6-.7-2.1 1.2L16 23h-4l-.7-2.7-2.1-1.2-2.6.7-2-3.5 1.9-1.9v-2.5l-1.9-1.9 2-3.5 2.6.7 2.1-1.2L12 3Z"/><circle cx="14" cy="12.8" r="3"/></svg>;
  if (icon === "disconnected") return <svg className={svgClass} viewBox="0 0 28 28"><path d="M8 8a8 8 0 0 1 12 10M7 18a8 8 0 0 1 0-8m3 5a5 5 0 0 1 8-4m-6 7a2 2 0 0 1 3-2"/><path d="m5 5 18 18"/></svg>;
  if (icon === "limit") return <svg className={svgClass} viewBox="0 0 28 28"><circle cx="14" cy="14" r="10"/><path d="M14 8v7m0 4v.1"/></svg>;
  if (icon === "success") return <svg className="h-[30px] w-[30px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2.5] [filter:drop-shadow(0_0_4px_rgba(30,234,183,0.6))]" viewBox="0 0 28 28"><path d="m7 14 5 5L22 9" /></svg>;
  if (icon === "warning") return <svg className="h-[30px] w-[30px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]" viewBox="0 0 28 28"><path d="M14 4 26 24H2L14 4Z"/><path d="M14 11v6m0 3.5v.1" /></svg>;
  return <span className="absolute inset-[-2px] animate-spin rounded-full border-2 border-transparent border-b-[#22cde2] border-l-[#22cde2] border-t-[#52d9ee]" />;
}
