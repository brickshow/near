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
import { NearMeetReveal, WorkWindow } from "./NearMeetReveal";

export type NearFeatureWalkthroughProps = {
  narrationEnabled?: boolean;
  musicEnabled?: boolean;
  /** Enable only verified source clips. Missing beats remain labeled placeholders. */
  recordedCaptures?: Partial<Record<FeatureCaptureKey, boolean>>;
};

export const FEATURE_WALKTHROUGH_TIMING = {
  talk: [0, 750],
  chat: [750, 1320],
  bible: [1320, 2070],
  journey: [2070, 2820],
  notes: [2820, 3720],
  music: [3720, 4350],
  church: [4350, 5010],
  voiceMusic: [5010, 6150],
  fullDemoStartFrame: 2250,
} as const;

export const FEATURE_CAPTURE_SLOTS = [
  {
    key: "talk",
    title: "Talk to NEAR",
    start: FEATURE_WALKTHROUGH_TIMING.talk[0],
    end: FEATURE_WALKTHROUGH_TIMING.talk[1],
    narration: "near-feature-01-voice.mp3",
    capture: "01-talk.mp4",
    prompt: "Hold N · ask for a verse · release N · hear NEAR reply",
    appAudioAfter: 310,
  },
  {
    key: "chat",
    title: "Chat",
    start: FEATURE_WALKTHROUGH_TIMING.chat[0],
    end: FEATURE_WALKTHROUGH_TIMING.chat[1],
    narration: "near-feature-02-voice.mp3",
    capture: "02-chat.mp4",
    prompt: "Type “What’s one question I can reflect on after reading Psalm 46:10?” · show the reply",
    appAudioAfter: 570,
  },
  {
    key: "bible",
    title: "Bible · Read aloud",
    start: FEATURE_WALKTHROUGH_TIMING.bible[0],
    end: FEATURE_WALKTHROUGH_TIMING.bible[1],
    narration: "near-feature-03-voice.mp3",
    capture: "03-bible-read-aloud.mp4",
    prompt: "Open Psalm 117 · use Read chapter · let the NEAR voice play",
    appAudioAfter: 350,
  },
  {
    key: "journey",
    title: "Journey",
    start: FEATURE_WALKTHROUGH_TIMING.journey[0],
    end: FEATURE_WALKTHROUGH_TIMING.journey[1],
    narration: "near-feature-04-voice.mp3",
    capture: "04-journey.mp4",
    prompt: "Save the three-workday Scripture and reflection goal",
    appAudioAfter: 425,
  },
  {
    key: "notes",
    title: "Notes · Linked Scripture",
    start: FEATURE_WALKTHROUGH_TIMING.notes[0],
    end: FEATURE_WALKTHROUGH_TIMING.notes[1],
    narration: "near-feature-05-voice.mp3",
    capture: "05-notes-verse-link.mp4",
    prompt: "Save Psalm 46:10 in a note · click it · open the passage",
    appAudioAfter: 430,
  },
  {
    key: "music",
    title: "Music controls",
    start: FEATURE_WALKTHROUGH_TIMING.music[0],
    end: FEATURE_WALKTHROUGH_TIMING.music[1],
    narration: "near-feature-06-voice.mp3",
    capture: "06-music-controls.mp4",
    prompt: "Show a cleared worship track · pause · resume · retain title",
    appAudioAfter: 250,
  },
  {
    key: "church",
    title: "Church calendar",
    start: FEATURE_WALKTHROUGH_TIMING.church[0],
    end: FEATURE_WALKTHROUGH_TIMING.church[1],
    narration: "near-feature-07-voice.mp3",
    capture: "07-church-calendar.mp4",
    prompt: "Select a sample small-group event · show date and time",
    appAudioAfter: 380,
  },
  {
    key: "voiceMusic",
    title: "Talk to NEAR · Play music",
    start: FEATURE_WALKTHROUGH_TIMING.voiceMusic[0],
    end: FEATURE_WALKTHROUGH_TIMING.voiceMusic[1],
    narration: "near-feature-08-voice.mp3",
    capture: "08-voice-play-music.mp4",
    prompt: "Start paused · say “Play Amazing Grace” · show the match playing",
    appAudioAfter: 240,
  },
] as const;

export type FeatureCaptureKey = (typeof FEATURE_CAPTURE_SLOTS)[number]["key"];

const calculateMetadata: CalculateMetadataFunction<NearFeatureWalkthroughProps> = () => ({
  durationInFrames: 6150,
  fps: 30,
  width: 1920,
  height: 1080,
});

const milk = "#F4F2E8";

const musicVolume = (frame: number) => interpolate(
  frame,
  [0, 330, 410, 700, 750, 1100, 1320, 1690, 1740, 2070, 2430, 2550, 2820, 3240, 3370, 3720, 3900, 4050, 4350, 4570, 4740, 5010, 5350, 5460, 5570, 6000, 6150],
  [0.23, 0.17, 0.055, 0.06, 0.20, 0.14, 0.16, 0.14, 0.055, 0.19, 0.16, 0.055, 0.20, 0.15, 0.055, 0.20, 0.14, 0.035, 0.17, 0.14, 0.055, 0.19, 0.13, 0.055, 0.015, 0.015, 0],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) },
);

const FeaturePlaceholder: React.FC<{
  title: string;
  prompt: string;
  filename: string;
  offset: number;
  duration: number;
}> = ({ title, prompt, filename, offset, duration }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - offset;
  const { fps } = useVideoConfig();
  const enter = spring({ frame: localFrame - 14, fps, config: { damping: 25, stiffness: 82, mass: 0.9 } });
  const presence = interpolate(localFrame, [0, 18, duration - 25, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const titleY = interpolate(enter, [0, 1], [25, 0]);
  const keycap = title.toLowerCase().includes("talk to near") || title.toLowerCase().includes("play music");
  return <div style={{ position: "absolute", inset: 0, opacity: presence, pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 420, background: "linear-gradient(180deg, transparent 0%, rgba(5,10,13,.60) 36%, rgba(5,10,13,.96) 100%)" }} />
    <div style={{ position: "absolute", left: 142, right: 120, bottom: 96, overflow: "hidden", color: milk, transform: `translateY(${titleY}px)` }}>
      <div style={{ width: 1450, height: 70, overflow: "hidden" }}>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 54, lineHeight: 1.12, letterSpacing: "-.035em", transform: `translateY(${interpolate(enter, [0, 1], [72, 0])}px)` }}>{title}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 15, marginTop: 12, color: "#efb76d", fontFamily: "Arial, sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: ".1em", textTransform: "uppercase" }}>
        {keycap && <span style={{ display: "inline-grid", width: 34, height: 34, placeItems: "center", border: "1px solid rgba(239,183,109,.75)", borderBottomWidth: 4, borderRadius: 7, background: "rgba(239,183,109,.12)", fontSize: 18, letterSpacing: 0 }}>N</span>}
        <span>Placeholder · real screen recording needed</span>
      </div>
      <p style={{ margin: "12px 0 0", color: "#f3f1e8", fontFamily: "Arial, sans-serif", fontSize: 23, lineHeight: 1.3 }}>{prompt}</p>
      <p style={{ margin: "9px 0 0", color: "#aeb9bd", fontFamily: "monospace", fontSize: 16 }}>{`public/captures/${filename}`}</p>
    </div>
  </div>;
};


const RecordedFeatureCapture: React.FC<{ feature: (typeof FEATURE_CAPTURE_SLOTS)[number] }> = ({ feature }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const length = feature.end - feature.start;
  const local = frame;
  const exit = interpolate(local, [length - 45, length], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const scale = interpolate(local, [0, 48, length - 45, length], [1.015, 1.075, 1.075, 1.02], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const focusY = feature.key === "talk" || feature.key === "voiceMusic" ? "44%" : "50%";
  const titleIn = spring({ frame: local - 10, fps, config: { damping: 24, stiffness: 90 } });
  const titleOpacity = interpolate(titleIn, [0, 1], [0, 1]) * Math.min(1, exit);
  const revealTitle = feature.key === "talk" || feature.key === "voiceMusic";
  return <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#090f14" }}>
    <Video
      src={staticFile(`captures/scene-3/${feature.capture}`)}
      volume={(localFrame) => interpolate(localFrame, [0, feature.appAudioAfter, feature.appAudioAfter + 18], [0, 0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) })}
      style={{ position: "absolute", width: 1920, height: 1080, left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: `50% ${focusY}` }}
    />
    <div style={{ position: "absolute", inset: 0, opacity: titleOpacity, pointerEvents: "none", background: "linear-gradient(90deg,rgba(4,9,12,.34),transparent 52%)" }} />
    <div style={{ position: "absolute", left: 94, top: 68, opacity: titleOpacity, transform: `translateY(${interpolate(titleIn,[0,1],[16,0])}px)`, color: milk, fontFamily: "Arial,sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", textShadow: "0 2px 18px rgba(0,0,0,.8)" }}>
      {revealTitle && <span style={{ display: "inline-grid", width: 31, height: 34, placeItems: "center", marginRight: 12, border: "1px solid rgba(239,183,109,.84)", borderBottomWidth: 4, borderRadius: 6, color: "#efb76d", background: "rgba(8,14,19,.62)" }}>N</span>}
      {feature.title}
    </div>
  </div>;
};

export const NearFeatureWalkthrough: React.FC<NearFeatureWalkthroughProps> = ({
  narrationEnabled = true,
  musicEnabled = true,
  recordedCaptures = {},
}) => {
  const frame = useCurrentFrame();
  const active = FEATURE_CAPTURE_SLOTS.find((feature) => frame >= feature.start && frame < feature.end) ?? FEATURE_CAPTURE_SLOTS[FEATURE_CAPTURE_SLOTS.length - 1];
  const beatFrame = frame - active.start;
  const beatLength = active.end - active.start;
  const push = interpolate(beatFrame, [0, beatLength], [1.17, 1.195], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const closeFade = interpolate(frame, [12, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const activeHasCapture = recordedCaptures[active.key] === true;
  return <div style={{ position: "relative", width: 1920, height: 1080, overflow: "hidden", background: "#080e13", color: milk }}>
    {narrationEnabled && FEATURE_CAPTURE_SLOTS.map((feature) => <Sequence key={`narration-${feature.key}`} from={feature.start} durationInFrames={feature.end - feature.start}>
      <Audio src={staticFile(`audio/${feature.narration}`)} />
    </Sequence>)}
    {musicEnabled && <Audio src={staticFile("audio/near-feature-walkthrough-music.wav")} volume={musicVolume(frame)} />}

    {/* One-frame handoff starts on Scene 2's exact expanded verse frame. */}
    {frame < 28 && <Sequence durationInFrames={28} freeze={899}>
      <NearMeetReveal narrationEnabled={false} musicEnabled={false} />
    </Sequence>}

    {!activeHasCapture && <div style={{ position: "absolute", inset: 0, opacity: closeFade, background: "radial-gradient(ellipse at 50% 40%, rgba(36,82,80,.24), transparent 62%), linear-gradient(180deg,#0b1218,#090e13 64%,#070b0e)" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 1464, height: 924, padding: 12, borderRadius: 25, boxSizing: "border-box", background: "linear-gradient(135deg,#697278,#20272d 36%,#4b555b 69%,#1d252b)", boxShadow: "0 42px 120px rgba(0,0,0,.72), 0 0 0 1px rgba(216,233,225,.19)", transform: `translate(-50%,-50%) scale(${push})`, transformOrigin: "center center" }}>
        <div style={{ position: "relative", width: 1440, height: 900, overflow: "hidden", borderRadius: 15, background: "#eef1f4" }}>
          <WorkWindow />
          <Img src={staticFile("captures/near-notch-expanded.png")} style={{ position: "absolute", zIndex: 8, left: 380, top: 32, width: 680, height: 180, transform: "scale(1.2)", transformOrigin: "center top" }} />
          <div style={{ position: "absolute", inset: 0, zIndex: 9, background: "rgba(3,8,12,.035)" }} />
        </div>
      </div>
    </div>}

    {FEATURE_CAPTURE_SLOTS.map((feature) => recordedCaptures[feature.key] ? <Sequence key={`capture-${feature.key}`} from={feature.start} durationInFrames={feature.end - feature.start}>
      <RecordedFeatureCapture feature={feature} />
    </Sequence> : null)}

    {!activeHasCapture && frame >= 28 && <FeaturePlaceholder
      title={active.title}
      prompt={active.prompt}
      filename={`scene-3/${active.capture}`}
      offset={active.start}
      duration={active.end - active.start}
    />}
  </div>;
};

export const NearFeatureWalkthroughComposition = () => <Composition
  id="NearFeatureWalkthrough"
  component={NearFeatureWalkthrough}
  durationInFrames={6150}
  fps={30}
  width={1920}
  height={1080}
  calculateMetadata={calculateMetadata}
  defaultProps={{ narrationEnabled: true, musicEnabled: true, recordedCaptures: {} }}
/>;
