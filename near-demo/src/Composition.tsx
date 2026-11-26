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
} from "remotion";

type Props = {
  narrationEnabled?: boolean;
  musicEnabled?: boolean;
};

export const INTRO_TIMING = {
  morning: [0, 270],
  work: [270, 660],
  night: [660, 1020],
  question: [1020, 1350],
} as const;

export const INTRO_COPY = {
  morning: ["I’ll read my Bible…", "after this one thing."],
  notifications: ["Meeting in 5 min", "Deadline today", "3 unread messages"],
  question: "Have you felt far from God lately?",
} as const;

const calculateMetadata: CalculateMetadataFunction<Props> = () => ({
  durationInFrames: 1350,
  fps: 30,
  width: 1920,
  height: 1080,
});

const milk = "#F7F1E6";

const fade = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

const MaskedLine: React.FC<{
  text: string;
  start: number;
  end: number;
  top: number;
  fontSize?: number;
  align?: "left" | "center";
}> = ({ text, start, end, top, fontSize = 76, align = "left" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - start, fps, config: { damping: 22, stiffness: 75, mass: 1.1 } });
  const opacity = fade(frame, start, start + 14) * (1 - fade(frame, end - 14, end));
  return (
    <div style={{ position: "absolute", top, left: 0, width: "100%", height: fontSize * 1.35, overflow: "hidden", textAlign: align, paddingLeft: align === "left" ? 180 : 0, boxSizing: "border-box" }}>
      <div style={{ color: milk, fontFamily: "Georgia, 'Times New Roman', serif", fontSize, fontWeight: 400, letterSpacing: "-0.035em", lineHeight: 1.2, opacity, transform: `translateY(${interpolate(p, [0, 1], [fontSize * 1.15, 0])}px)`, textShadow: "0 4px 30px rgba(0,0,0,.30)" }}>{text}</div>
    </div>
  );
};

const Notification: React.FC<{ text: string; start: number; index: number }> = ({ text, start, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - start, fps, config: { damping: 18, stiffness: 110, mass: 0.8 } });
  const opacity = fade(frame, start, start + 10) * (1 - fade(frame, 636, 660));
  const y = 252 + index * 112;
  return (
    <div style={{ position: "absolute", top: y, right: 166, width: 492, minHeight: 74, boxSizing: "border-box", padding: "19px 26px", borderRadius: 15, background: "rgba(25, 29, 31, .78)", border: "1px solid rgba(255,255,255,.20)", color: "#FBF8F1", fontFamily: "Arial, sans-serif", fontSize: 27, letterSpacing: ".005em", boxShadow: "0 14px 50px rgba(0,0,0,.24)", opacity, transform: `translateX(${interpolate(p, [0, 1], [58, 0])}px)` }}>
      <span style={{ display: "inline-block", width: 10, height: 10, marginRight: 16, borderRadius: 10, background: index === 0 ? "#D59A54" : "#B6C5C9", verticalAlign: 2 }} />{text}
    </div>
  );
};

const MorningStack: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const overall = 1 - fade(frame, 636, 660);
  return <div style={{ position: "absolute", left: 310, top: 638, width: 720, height: 280, color: milk, fontFamily: "Arial, sans-serif", fontSize: 69, fontWeight: 800, letterSpacing: ".10em", lineHeight: 1.0, textAlign: "center", opacity: overall, textShadow: "0 4px 22px rgba(0,0,0,.38)" }}>
    {[0, 1, 2, 3].map((copy) => {
      const enter = 408 + copy * 5;
      const p = spring({ frame: frame - enter, fps, config: { damping: 16, stiffness: 125 } });
      return <div key={copy} style={{ position: "absolute", inset: 0, transform: `translateY(${interpolate(p, [0, 1], [-96 + copy * 20, copy * 34])}px) scale(${interpolate(p, [0, 1], [.92, 1])})`, opacity: interpolate(frame, [enter, enter + 8, 620, 650], [0, 0.58, 0.58, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), filter: `blur(${interpolate(p, [0, 1], [4, 0])}px)` }}>ONE THING</div>;
    })}
  </div>;
};

const NearProblemIntro: React.FC<Props> = ({ narrationEnabled = true, musicEnabled = true }) => {
  const frame = useCurrentFrame();
  const morningFade = 1 - fade(frame, 645, 672);
  const nightFade = fade(frame, 645, 672) * (1 - fade(frame, 1320, 1350));
  const pushMorning = interpolate(frame, [0, 270], [1, 1.075], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const pushNight = interpolate(frame, [660, 930], [1.045, 1.08], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const laptopDark = fade(frame, 784, 817);
  const finalFade = fade(frame, 1075, 1135) * (1 - fade(frame, 1320, 1350));

  return <div style={{ width: 1920, height: 1080, overflow: "hidden", background: "#111820", position: "relative" }}>
    {narrationEnabled && <>
      <Sequence><Audio src={staticFile("audio/narration-morning.mp3")} /></Sequence>
      <Sequence from={270}><Audio src={staticFile("audio/narration-work.mp3")} /></Sequence>
      <Sequence from={660}><Audio src={staticFile("audio/narration-night.mp3")} /></Sequence>
      <Sequence from={1020}><Audio src={staticFile("audio/narration-question.mp3")} /></Sequence>
    </>}
    {musicEnabled && <Audio
      src={staticFile("audio/problem-music.wav")}
      volume={(f) => {
        const duck = interpolate(f, [940, 1020, 1350], [1, 0.08, 0.08], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return 0.22 * duck;
      }}
    />}

    {/* Morning plate: the two image transforms create a restrained foreground/background depth drift. */}
    <div style={{ position: "absolute", inset: -60, opacity: morningFade, transform: `scale(${pushMorning}) translateX(${interpolate(frame, [0, 270], [0, -18], { extrapolateRight: "clamp" })}px)` }}>
      <Img src={staticFile("assets/desk-morning.png")} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", filter: "brightness(.78) saturate(.88)" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(32,22,13,.45), rgba(25,20,17,.04) 70%), linear-gradient(0deg, rgba(17,18,18,.34), transparent 48%)" }} />
    </div>
    <MaskedLine text={INTRO_COPY.morning[0]} start={34} end={182} top={170} fontSize={78} />
    <MaskedLine text={INTRO_COPY.morning[1]} start={112} end={250} top={270} fontSize={78} />

    {/* Work beat overlays remain independent for easy retiming. */}
    <div style={{ position: "absolute", inset: 0, opacity: morningFade }}>
      {INTRO_COPY.notifications.map((text, i) => <Notification key={text} text={text} start={[296, 377, 430][i]} index={i} />)}
    </div>
    <MorningStack />

    {/* Matched late-night plate with the laptop closed beside the Bible. */}
    <div style={{ position: "absolute", inset: -52, opacity: nightFade, transform: `scale(${pushNight})` }}>
      <Img src={staticFile("assets/desk-night-closed.png")} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", filter: `brightness(${interpolate(laptopDark, [0, 1], [.78, .56])}) saturate(.72)` }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(11,18,29,.40), rgba(14,20,30,.06) 70%), linear-gradient(0deg, rgba(8,14,23,.43), transparent 55%)" }} />
      <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, background: `rgba(8,14,23,${laptopDark * .22})` }} />
    </div>
    {/* The final question rests over the Bible and closed laptop, then the desk fades to black. */}
    <div style={{ position: "absolute", inset: 0, opacity: nightFade, background: "linear-gradient(180deg, rgba(7,12,20,.20), transparent 58%, rgba(7,12,20,.15))" }} />
    <div style={{ position: "absolute", top: 302, left: 190, width: 1540, textAlign: "center", color: milk, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 78, lineHeight: 1.25, letterSpacing: "-.03em", opacity: finalFade, textShadow: "0 4px 40px rgba(0,0,0,.55)" }}>
      {INTRO_COPY.question}
    </div>
  </div>;
};

export const MyComposition = () => <Composition id="MyComp" component={NearProblemIntro} durationInFrames={60} fps={30} width={1280} height={720} />;

export const NearProblemIntroComposition = () => <Composition id="NearProblemIntro" component={NearProblemIntro} durationInFrames={1350} fps={30} width={1920} height={1080} calculateMetadata={calculateMetadata} defaultProps={{ narrationEnabled: true, musicEnabled: true }} />;

export default NearProblemIntro;
