import { useCurrentFrame, useVideoConfig } from "remotion";
import captions from "./english-captions.json";

type Cue = { startMs: number; endMs: number; text: string; placement?: string };

export function EnglishSubtitles() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = frame * 1000 / fps;
  const cue = (captions as Cue[]).find(({startMs, endMs}) => startMs <= now && now < endMs);
  if (!cue) return null;
  return <div style={{
    position: "absolute", left: 90, right: 90,
    ...(cue.placement === "top" ? {top: 70} : cue.placement === "upper-left" ? {top: 155, right: 600, textAlign: "left"} : cue.placement === "panel" ? {bottom: 80, right: 600} : {bottom: 54}),
    textAlign: "center", pointerEvents: "none", whiteSpace: "pre",
    color: "#f4f2e8", font: '600 46px/1.22 "Segoe UI", Arial, sans-serif',
  }}>{cue.text.split("\n").map((line, index) => <div key={index}>
    <span style={{background: "rgba(9,11,13,.72)", padding: "1px 9px 4px"}}>{line}</span>
  </div>)}</div>;
}
