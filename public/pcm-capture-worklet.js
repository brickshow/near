// Emit the first partial after 2 seconds, then every 1.5 seconds with 0.5s
// of overlap so Whisper has context at the edges without making the UI wait
// as long for the first words.
const WINDOW_SAMPLES = 32_000;
const HOP_SAMPLES = 24_000;

class NearPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = [];
    this.sentWindow = false;
    this.stopped = false;
    this.port.onmessage = ({ data }) => {
      if (data === "flush") {
        this.stopped = true;
        const overlap = this.sentWindow ? WINDOW_SAMPLES - HOP_SAMPLES : 0;
        // The retained overlap was already sent in the previous full window.
        // Only run Whisper again when there is new audio as well.
        if (this.pending.length > overlap) this.send(this.pending);
        this.pending = [];
        this.port.postMessage({ type: "flushed" });
      } else if (data === "cancel") {
        this.stopped = true;
        this.pending = [];
        this.port.postMessage({ type: "flushed" });
      }
    };
  }

  send(samples) {
    const chunk = Float32Array.from(samples);
    this.port.postMessage({ type: "audio", samples: chunk }, [chunk.buffer]);
  }

  process(inputs, outputs) {
    for (const output of outputs) for (const channel of output) channel.fill(0);
    if (this.stopped) return false;
    const channels = inputs[0];
    if (!channels?.length) return true;
    const frameCount = channels[0].length;
    for (let frame = 0; frame < frameCount; frame += 1) {
      let sample = 0;
      for (const channel of channels) sample += channel[frame] ?? 0;
      this.pending.push(sample / channels.length);
    }
    while (this.pending.length >= WINDOW_SAMPLES) {
      this.send(this.pending.slice(0, WINDOW_SAMPLES));
      this.sentWindow = true;
      this.pending = this.pending.slice(HOP_SAMPLES);
    }
    return true;
  }
}

registerProcessor("near-pcm-capture", NearPcmCapture);
