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
  question: "Drifting away from God?",
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
  const p = interpolate(frame, [start, start + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
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

const NearProblemIntro: React.FC<Props> = ({ narrationEnabled = true, musicEnabled = true }) => {
  const frame = useCurrentFrame();
  const morningFade = Number(frame < 660);
  const nightFade = Number(frame >= 660) * (1 - 0.85 * fade(frame, 1335, 1349));
  const pushMorning = interpolate(frame, [0, 660], [1, 1.14], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const pushNight = interpolate(frame, [660, 1320], [1.045, 1.15], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const laptopDark = fade(frame, 784, 817);
  const finalFade = fade(frame, 1160, 1200) * (1 - fade(frame, 1335, 1349));
  const nightCloseup = frame < 1020 ? pushNight : interpolate(frame, [1020, 1349], [1.31, 1.4], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });

  return <div style={{ width: 1920, height: 1080, overflow: "hidden", background: "#050709", position: "relative" }}>
    {narrationEnabled && <Audio src={staticFile("audio/near-problem-male.wav")} />}
    {musicEnabled && <Audio
      src={staticFile("audio/problem-music.wav")}
      volume={(f) => {
        const duck = interpolate(f, [940, 1020, 1350], [1, 0.08, 0.08], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return 0.22 * duck;
      }}
    />}

    {/* Morning plate: the two image transforms create a restrained foreground/background depth drift. */}
    <div style={{ position: "absolute", inset: -60, opacity: morningFade, transform: `scale(${pushMorning}) translateX(${interpolate(frame, [0, 660], [0, -86], { extrapolateRight: "clamp" })}px)` }}>
      <Img src={staticFile("assets/desk-morning.png")} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", filter: "brightness(.78) saturate(.88)" }} />
      <Img src={staticFile("assets/desk-morning.png")} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", filter: "brightness(.78) saturate(.88)", maskImage: "linear-gradient(transparent 58%, black 84%)", transform: `scale(${1 + .012 * fade(frame, 0, 270)})`, transformOrigin: "center bottom" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(32,22,13,.45), rgba(25,20,17,.04) 70%), linear-gradient(0deg, rgba(17,18,18,.34), transparent 48%)" }} />
    </div>
    <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 310, opacity: morningFade, pointerEvents: "none", background: "linear-gradient(90deg, transparent, rgba(255,226,181,.24) 50%, transparent)", mixBlendMode: "screen", transform: `translateX(${interpolate(frame, [0, 660], [-420, 2100], { extrapolateRight: "clamp" })}px)` }} />
    <MaskedLine text={INTRO_COPY.morning[0]} start={34} end={250} top={170} fontSize={78} />
    <MaskedLine text={INTRO_COPY.morning[1]} start={112} end={250} top={270} fontSize={78} />

    <div style={{ position: "absolute", inset: 0, opacity: morningFade, pointerEvents: "none", background: `linear-gradient(90deg, rgba(9,12,14,${interpolate(frame, [270, 620], [0, .38], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}), transparent 72%)` }} />
    <MaskedLine text="A meeting starts." start={280} end={341} top={170} fontSize={72} />
    <MaskedLine text="A deadline moves up." start={342} end={410} top={170} fontSize={72} />
    <MaskedLine text="The messages keep coming." start={411} end={509} top={170} fontSize={66} />
    <MaskedLine text="Something else needs your attention." start={510} end={655} top={170} fontSize={61} />

    {/* Work beat overlays remain independent for easy retiming. */}
    <div style={{ position: "absolute", inset: 0, opacity: morningFade }}>
      {INTRO_COPY.notifications.map((text, i) => <Notification key={text} text={text} start={[296, 377, 430][i]} index={i} />)}
    </div>
    {musicEnabled && [296, 377, 430].map((from, index) => <Sequence key={from} from={from} durationInFrames={26}><Audio src={staticFile("audio/near-notch-pluck.wav")} volume={.09 + index * .018} /></Sequence>)}

    {/* Matched late-night plate with the laptop closed beside the Bible. */}
    <div style={{ position: "absolute", inset: -52, opacity: nightFade, transform: `scale(${nightCloseup}) translateX(${interpolate(frame, [660, 1320], [-25, 55], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`, transformOrigin: "54% 67%" }}>
      <Img src={staticFile("assets/desk-night-closed.png")} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", filter: `brightness(${interpolate(laptopDark, [0, 1], [.78, .56])}) saturate(.72)` }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(11,18,29,.40), rgba(14,20,30,.06) 70%), linear-gradient(0deg, rgba(8,14,23,.43), transparent 55%)" }} />
      <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, background: `rgba(8,14,23,${laptopDark * .22})` }} />
    </div>
    <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 340, opacity: nightFade, pointerEvents: "none", background: "linear-gradient(90deg, transparent, rgba(125,168,202,.22) 50%, transparent)", mixBlendMode: "screen", transform: `translateX(${interpolate(frame, [660, 1320], [2020, -420], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)` }} />
    {/* The final question rests over the Bible and closed laptop, then the desk fades to black. */}
    <div style={{ position: "absolute", inset: 0, opacity: nightFade, background: "linear-gradient(180deg, rgba(7,12,20,.20), transparent 58%, rgba(7,12,20,.15))" }} />
    <MaskedLine text="Another day is gone." start={720} end={810} top={190} fontSize={75} />
    <MaskedLine text="One Bible verse." start={850} end={914} top={190} fontSize={81} />
    <MaskedLine text="A moment to reflect." start={915} end={1006} top={190} fontSize={76} />
    <MaskedLine text="One busy day becomes a whole week." start={1027} end={1150} top={190} fontSize={69} />
    <div style={{ position: "absolute", top: 302, left: 190, width: 1540, textAlign: "center", color: milk, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 78, lineHeight: 1.25, letterSpacing: "-.03em", opacity: finalFade, textShadow: "0 4px 40px rgba(0,0,0,.55)" }}>
      {INTRO_COPY.question}
    </div>
  </div>;
};

export const MyComposition = () => <Composition id="MyComp" component={NearProblemIntro} durationInFrames={60} fps={30} width={1280} height={720} />;

export const NearProblemIntroComposition = () => <Composition id="NearProblemIntro" component={NearProblemIntro} durationInFrames={1350} fps={30} width={1920} height={1080} calculateMetadata={calculateMetadata} defaultProps={{ narrationEnabled: true, musicEnabled: true }} />;

export default NearProblemIntro;
