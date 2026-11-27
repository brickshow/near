import React from "react";
import {
  Audio,
  CalculateMetadataFunction,
  Composition,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from "remotion";

export type NearMeetProps = {
  narrationEnabled?: boolean;
  musicEnabled?: boolean;
};

export const NEAR_MEET_TIMING = {
  meet: [0, 300],
  collapsed: [300, 480],
  open: [480, 750],
  walkthrough: [750, 900],
  fullDemoStartFrame: 1350,
} as const;

export const NEAR_MEET_COPY = {
  title: "Meet NEAR",
  name: "New Encounter and Renewal",
  walkthrough: "A little closer each day.",
  narration: [
    "That’s why I built NEAR. The name stands for New Encounter and Renewal. It’s a desktop faith companion that helps you make time for God.",
    "NEAR lives in a little notch at the top of your screen.",
    "Open NEAR right over what you’re working on. Your apps stay open, and today’s Bible verse is right there.",
    "Let’s take a moment to read a verse and reflect on it.",
  ],
} as const;

const calculateMetadata: CalculateMetadataFunction<NearMeetProps> = () => ({
  durationInFrames: 900,
  fps: 30,
  width: 1920,
  height: 1080,
});

const titleMilk = "#F4F2E8";

export const WorkWindow = () => (
  <div style={{ position: "absolute", inset: 0, background: "#eef1f4", color: "#253247", fontFamily: "Arial, sans-serif" }}>
    {/* GNOME top panel stays in frame; the recorded notch starts exactly at its lower edge. */}
    <div style={{ height: 32, boxSizing: "border-box", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "0 10px", background: "#171819", color: "#f5f5f5", fontFamily: "Arial, sans-serif", fontSize: 13, lineHeight: 1 }}>
      <div style={{ width: 57, height: 21, boxSizing: "border-box", padding: "0 8px", display: "flex", alignItems: "center", gap: 7, borderRadius: 14, background: "#303135", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}>
        <span style={{ width: 27, height: 7, borderRadius: 5, background: "#ededed" }} />
        <span style={{ width: 5, height: 5, borderRadius: 5, background: "#7f8185" }} />
      </div>
      <span style={{ fontWeight: 500, letterSpacing: ".01em" }}>Nov 27&nbsp; 00:36</span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 17, paddingRight: 8, color: "#eeeeee", fontSize: 15 }}>
        <span aria-hidden="true">✣</span>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v4M4 12V9m8 3V9M4 9h8M8 7H4m4 0h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="2.5" r="1.4" fill="currentColor"/><circle cx="4" cy="13" r="1.4" fill="currentColor"/><circle cx="12" cy="13" r="1.4" fill="currentColor"/></svg>
        <span aria-hidden="true">◖))</span>
        <span style={{ fontSize: 17 }} aria-hidden="true">⏻</span>
      </div>
    </div>
    <div style={{ height: 58, padding: "0 54px", display: "flex", alignItems: "center", gap: 45, background: "#253348", color: "#f7f9fb", fontSize: 15 }}>
      <strong style={{ fontSize: 20, letterSpacing: "-.04em" }}>northstar</strong>
      <span style={{ color: "#dae2eb" }}>My day</span><span style={{ color: "#9facbc" }}>Projects</span><span style={{ color: "#9facbc" }}>Team</span>
      <div style={{ marginLeft: 38, width: 390, borderRadius: 8, padding: "10px 14px", background: "#35465d", color: "#b6c2d0" }}>⌕ &nbsp; Search your workspace</div>
      <span style={{ marginLeft: "auto", color: "#dce4ec" }}>Jordan Lee &nbsp; · &nbsp; Thu, Nov 26</span>
    </div>
    <main style={{ padding: "45px 68px" }}>
      <div style={{ color: "#77859a", fontSize: 12, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase" }}>Thursday · Focus day</div>
      <h1 style={{ margin: "10px 0 24px", color: "#202d42", fontSize: 34, letterSpacing: "-.04em", fontWeight: 600 }}>Good morning, Jordan</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1.18fr .82fr", gap: 22 }}>
        <section style={{ border: "1px solid #dce2e9", borderRadius: 14, background: "#fff", padding: "24px 27px", minHeight: 540, boxShadow: "0 12px 34px rgba(24,37,55,.05)" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "#26354c" }}>Today’s schedule <small style={{ marginLeft: 12, color: "#53816e", background: "#e8f2ec", padding: "6px 10px", borderRadius: 20, fontSize: 12 }}>3 events</small></h2>
          {[
            ["9:30 AM", "Weekly product check-in", "Design team · 30 min · Meet"],
            ["11:00 AM", "Review launch notes", "Project NEAR · Draft due today"],
            ["1:30 PM", "Planning and priorities", "Studio room · 45 min"],
          ].map(([time, title, detail]) => <div key={title} style={{ display: "flex", gap: 18, borderTop: "1px solid #edf0f3", padding: "17px 0" }}>
            <span style={{ width: 70, color: "#67778e", fontSize: 14 }}>{time}</span><div><strong style={{ fontSize: 16, fontWeight: 600 }}>{title}</strong><div style={{ marginTop: 5, color: "#7b8798", fontSize: 14 }}>{detail}</div></div>
          </div>)}
          <div style={{ marginTop: 16, borderRadius: 10, padding: 19, background: "#f5f7f9", color: "#66768c", fontSize: 15, lineHeight: 1.6 }}><strong style={{ color: "#34425a" }}>Current focus</strong><br />Refine the demo flow, prepare a clear handoff, and send the updated notes before lunch.</div>
        </section>
        <section style={{ border: "1px solid #dce2e9", borderRadius: 14, background: "#fff", padding: "24px 25px", minHeight: 540, boxShadow: "0 12px 34px rgba(24,37,55,.05)" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "#26354c" }}>Recent messages</h2>
          {[
            ["AM", "Alex Morgan", "Thanks for sharing the outline. I’ll review the latest draft this morning."],
            ["SK", "Sam Kim", "Could we move the check-in to 9:30? I added the design notes."],
            ["JT", "Jamie Taylor", "The updated assets are ready when you have a moment."],
          ].map(([initials, name, note]) => <div key={name} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 12, padding: "18px 0", borderTop: "1px solid #edf0f3" }}>
            <span style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 20, background: "#e3ebf4", color: "#536d8b", fontSize: 11, fontWeight: 700 }}>{initials}</span><div><strong style={{ fontSize: 15, fontWeight: 600 }}>{name}</strong><div style={{ marginTop: 5, color: "#69788b", fontSize: 14, lineHeight: 1.45 }}>{note}</div></div>
          </div>)}
          <div style={{ marginTop: 6, color: "#738198", fontSize: 14 }}>3 unread messages</div>
        </section>
      </div>
    </main>
  </div>
);

const MaskedTitle: React.FC<{ children: React.ReactNode; start: number; end: number; top: number; size: number }> = ({ children, start, end, top, size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entry = spring({ frame: frame - start, fps, config: { damping: 23, stiffness: 88, mass: 0.9 } });
  const opacity = interpolate(frame, [start, start + 14, end - 18, end], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  return <div style={{ position: "absolute", top, left: 0, width: "100%", height: size * 1.25, overflow: "hidden", textAlign: "center", opacity }}>
    <div style={{ transform: `translateY(${interpolate(entry, [0, 1], [size, 0])}px)`, color: titleMilk, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: size, fontWeight: 400, letterSpacing: "-.04em", lineHeight: 1.08, textShadow: "0 4px 24px rgba(0,0,0,.38)" }}>{children}</div>
  </div>;
};

const NameLine: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [96, 119, 280, 304], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  return <div style={{ position: "absolute", top: 790, left: 0, width: "100%", textAlign: "center", fontFamily: "Arial, sans-serif", fontSize: 32, letterSpacing: ".055em", color: "#E9EEE8", opacity, textShadow: "0 2px 15px rgba(0,0,0,.75)" }}>
    {["New", "Encounter", "and", "Renewal"].map((word, index) => {
      const start = 98 + index * 10;
      const light = interpolate(frame, [start, start + 14], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
      return <span key={word}><b style={{color: `rgb(${233 - 146 * light}, ${238 - 14 * light}, ${232 - 66 * light})`}}>{word[0]}</b>{word.slice(1)} </span>;
    })}
  </div>;
};

export const NearMeetReveal: React.FC<NearMeetProps> = ({ narrationEnabled = true, musicEnabled = true }) => {
  const frame = useCurrentFrame();
  const finalLineOpacity = interpolate(frame, [NEAR_MEET_TIMING.walkthrough[0], 790, 900], [0, 1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  // Let each move settle before the still/video boundaries at frames 300 and 480.
  const cameraScale = interpolate(frame, [0, 240, 330, 465, 600, 900], [1.38, 1.02, 1.02, 1.6, 1.6, 1.13], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const audioBed = (f: number) => interpolate(f, [0, 12, 82, 240, 295, 300, 405, 426, 480, 550, 696, 750, 846, 900], [0.18, 0.30, 0.60, 0.54, 0.33, 0.30, 0.58, 0.58, 0.34, 0.52, 0.48, 0.28, 0.58, 0.52], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });

  return <div style={{ position: "relative", width: 1920, height: 1080, overflow: "hidden", background: "#070C0D", color: titleMilk }}>
    {narrationEnabled && <>
      <Audio src={staticFile("audio/near-meet-male.wav")} />
      <Sequence from={426}><Audio src={staticFile("audio/near-notch-pluck.wav")} volume={0.28} /></Sequence>
    </>}
    {musicEnabled && <>
      <Sequence durationInFrames={60}><Audio src={staticFile("audio/problem-music.wav")} startFrom={1290} volume={(f) => 0.45 * interpolate(f, [0, 42, 60], [1, 0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} /></Sequence>
      <Audio src={staticFile("audio/near-meet-music.wav")} volume={(f) => 0.72 * audioBed(f)} />
    </>}

    <div style={{ position: "absolute", inset: 0, transform: `scale(${cameraScale})`, transformOrigin: "50% 0%" }}>
      {frame < 480 && <Img src={staticFile("captures/scene-2/collapsed.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      {frame >= 300 && frame < 480 && <Sequence from={300} durationInFrames={180}>
        <Video src={staticFile("captures/scene-2/meet-near.mp4")} muted endAt={180} style={{ width: "100%", height: "100%", opacity: interpolate(frame, [300, 315], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
      </Sequence>}
      {frame >= 480 && <Img src={staticFile("captures/scene-2/expanded.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
    </div>
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(0deg, rgba(5,12,16,.58), transparent 40%)", opacity: interpolate(frame, [0, 290, 310], [1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />

    <MaskedTitle start={18} end={300} top={660} size={75}>{NEAR_MEET_COPY.title}</MaskedTitle>
    <NameLine />

    <div style={{ position: "absolute", left: 115, top: 790, color: "#EAF2E8", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 42, lineHeight: 1.16, letterSpacing: "-.025em", opacity: finalLineOpacity, textShadow: "0 3px 24px rgba(0,0,0,.75)" }}>
      {NEAR_MEET_COPY.walkthrough}
    </div>
  </div>;
};

export const NearMeetRevealComposition = () => <Composition id="NearMeetReveal" component={NearMeetReveal} durationInFrames={900} fps={30} width={1920} height={1080} calculateMetadata={calculateMetadata} defaultProps={{ narrationEnabled: true, musicEnabled: true }} />;
