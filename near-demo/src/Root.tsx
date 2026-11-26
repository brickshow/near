import React from "react";
import { Composition, Sequence } from "remotion";
import NearProblemIntro, { NearProblemIntroComposition } from "./Composition";
import { NearMeetReveal, NearMeetRevealComposition } from "./NearMeetReveal";
import { NearFeatureWalkthrough, NearFeatureWalkthroughComposition } from "./NearFeatureWalkthrough";
import { NearClosing, NearClosingComposition } from "./NearClosing";

const NearDemoScenes1And2: React.FC = () => (
  <>
    <Sequence durationInFrames={1350}>
      <NearProblemIntro narrationEnabled musicEnabled />
    </Sequence>
    <Sequence from={1350} durationInFrames={900}>
      <NearMeetReveal narrationEnabled musicEnabled />
    </Sequence>
  </>
);

const NearDemoThroughFeatureWalkthrough: React.FC = () => (
  <>
    <Sequence durationInFrames={1350}>
      <NearProblemIntro narrationEnabled musicEnabled />
    </Sequence>
    <Sequence from={1350} durationInFrames={900}>
      <NearMeetReveal narrationEnabled musicEnabled />
    </Sequence>
    <Sequence from={2250} durationInFrames={6150}>
      <NearFeatureWalkthrough narrationEnabled musicEnabled recordedCaptures={{}} />
    </Sequence>
  </>
);

const NearHackathonDemo: React.FC = () => (
  <>
    <Sequence durationInFrames={1350}><NearProblemIntro narrationEnabled musicEnabled /></Sequence>
    <Sequence from={1350} durationInFrames={900}><NearMeetReveal narrationEnabled musicEnabled /></Sequence>
    <Sequence from={2250} durationInFrames={6150}><NearFeatureWalkthrough narrationEnabled musicEnabled recordedCaptures={{}} /></Sequence>
    <Sequence from={8400} durationInFrames={600}><NearClosing narrationEnabled musicEnabled /></Sequence>
  </>
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <NearProblemIntroComposition />
      <NearMeetRevealComposition />
      <NearFeatureWalkthroughComposition />
      <NearClosingComposition />
      <Composition
        id="NearDemoScenes1And2"
        component={NearDemoScenes1And2}
        durationInFrames={2250}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="NearDemoThroughFeatureWalkthrough"
        component={NearDemoThroughFeatureWalkthrough}
        durationInFrames={8400}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="NearHackathonDemo"
        component={NearHackathonDemo}
        durationInFrames={9000}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
