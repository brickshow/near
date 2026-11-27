import React from "react";
import {
  Audio,
  CalculateMetadataFunction,
  Composition,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type NearClosingProps = {
  narrationEnabled?: boolean;
  musicEnabled?: boolean;
};

export const NEAR_CLOSING_TIMING = {
  close: [0, 0],
  storyLine: [0, 270],
  endCard: [270, 450],
  fullDemoStartFrame: 8550,
} as const;

export const NEAR_CLOSING_COPY = {
  story: "Even on a busy day, there’s room for one verse, a moment to reflect, or a song that helps you turn your attention back to God.",
    thanks: "That’s why I built NEAR. From Team ANCHOR, thanks for watching.",
  phrases: ["One verse.", "A moment to reflect."],
  name: "New Encounter and Renewal",
  tagline: "A little closer each day.",
  team: "Built by Team ANCHOR",
} as const;

const calculateMetadata: CalculateMetadataFunction<NearClosingProps> = () => ({
  durationInFrames: 450,
  fps: 30,
  width: 1920,
  height: 1080,
});

const milk = "#F4F2E8";
const nearGreen = "#47E2A2";

const musicVolume = (frame: number) => interpolate(
  frame,
  [0, 36, 78, 110, 125, 405, 420, 565, 584, 600],
  [0, 0, 0.09, 0.15, 0.055, 0.055, 0.052, 0.052, 0.07, 0],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) },
);

const MaskedPhrase: React.FC<{ text: string; start: number; end: number }> = ({ text, start, end }) => {
  const frame = useCurrentFrame() + 150;
  const { fps } = useVideoConfig();
  const local = frame - start;
  const entrance = spring({ frame: local, fps, config: { damping: 28, stiffness: 52, mass: 1.15 } });
  const opacity = interpolate(frame, [start, start + 20, end - 20, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad),
  });
  return <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity, pointerEvents: "none" }}>
    <div style={{ overflow: "hidden", padding: "0 30px 16px", color: milk, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 88, lineHeight: 1.12, letterSpacing: "-.035em", textAlign: "center", textShadow: "0 6px 44px rgba(0,0,0,.38)" }}>
      <div style={{ transform: `translateY(${interpolate(entrance, [0, 1], [105, 0])}px)` }}>{text}</div>
    </div>
  </div>;
};

const Initials: React.FC = () => <>
  <span style={{ color: nearGreen }}>N</span>ew{" "}
  <span style={{ color: nearGreen }}>E</span>ncounter{" "}
  <span style={{ color: nearGreen }}>a</span>nd{" "}
  <span style={{ color: nearGreen }}>R</span>enewal
</>;

const EndCard: React.FC = () => {
  const frame = useCurrentFrame() + 150;
  const { fps } = useVideoConfig();
  const reveal = spring({ frame: frame - 429, fps, config: { damping: 25, stiffness: 72, mass: 0.92 } });
  const opacity = interpolate(frame, [420, 472], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const lift = interpolate(reveal, [0, 1], [25, 0]);
  const scale = interpolate(reveal, [0, 1], [0.9, 1]);
  return <div style={{ position: "absolute", inset: 0, opacity, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: milk, textAlign: "center" }}>
    <div style={{ width: 154, height: 154, marginBottom: 12, opacity: reveal, transform: `translateY(${lift}px) scale(${scale})`, filter: "drop-shadow(0 0 24px rgba(51,231,181,.22))" }}>
      <Img src={staticFile("assets/near-appicon.png")} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    </div>
    <div style={{ opacity: reveal, transform: `translateY(${lift}px)`, color: "#F4F7F2", fontFamily: "Arial, sans-serif", fontSize: 79, lineHeight: 1, fontWeight: 750, letterSpacing: ".12em", paddingLeft: ".12em", textShadow: "0 0 34px rgba(45,218,179,.16)" }}>NEAR</div>
    <div style={{ marginTop: 24, opacity: reveal, transform: `translateY(${lift}px)`, fontFamily: "Arial, sans-serif", fontSize: 29, lineHeight: 1.25, fontWeight: 500, letterSpacing: ".015em" }}><Initials /></div>
    <div style={{ marginTop: 20, opacity: reveal, transform: `translateY(${lift}px)`, color: "#C8D7D1", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 30, fontStyle: "italic", letterSpacing: ".01em" }}>{NEAR_CLOSING_COPY.tagline}</div>
    <div style={{ marginTop: 38, opacity: reveal, transform: `translateY(${lift}px)`, color: "#99AAA6", fontFamily: "Arial, sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: ".22em", textTransform: "uppercase" }}>{NEAR_CLOSING_COPY.team}</div>
  </div>;
};

export const NearClosing: React.FC<NearClosingProps> = ({ narrationEnabled = true, musicEnabled = true }) => {
  const frame = useCurrentFrame() + 150;
  const fadeOutShot = interpolate(frame, [40, 112], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const glow = interpolate(frame, [65, 160, 430, 600], [0.1, 0.62, 0.52, 0.12], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  return <div style={{ position: "relative", width: 1920, height: 1080, overflow: "hidden", background: "#070D12", color: milk }}>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 53%, rgba(48,111,89,.14), transparent 60%), linear-gradient(180deg,#091016 0%,#080D12 100%)" }} />
    <div style={{ position: "absolute", left: "50%", top: "48%", width: 1100, height: 850, transform: "translate(-50%,-50%)", borderRadius: "50%", background: `radial-gradient(ellipse, rgba(57,216,151,${0.31 * glow}) 0%, rgba(37,134,107,${0.16 * glow}) 42%, transparent 73%)`, filter: "blur(65px)" }} />

    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 48%, #153229, #080D12 69%)", opacity: fadeOutShot }} />

    {narrationEnabled && <Audio src={staticFile("audio/near-closing-male.wav")} />}
    {musicEnabled && <Audio src={staticFile("audio/near-meet-music.wav")} volume={musicVolume(frame)} startFrom={450} />}

    <MaskedPhrase text={NEAR_CLOSING_COPY.phrases[0]} start={178} end={234} />
    <MaskedPhrase text={NEAR_CLOSING_COPY.phrases[1]} start={230} end={408} />

    <EndCard />
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 44%, rgba(0,0,0,.28) 100%)" }} />
  </div>;
};

export const NearClosingComposition = () => <Composition
  id="NearClosing"
  component={NearClosing}
  durationInFrames={450}
  fps={30}
  width={1920}
  height={1080}
  calculateMetadata={calculateMetadata}
  defaultProps={{ narrationEnabled: true, musicEnabled: true }}
/>;
