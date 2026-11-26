import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = join(scriptDir, "..");
const envText = await readFile(join(projectDir, ".env"), "utf8");
const env = Object.fromEntries(envText.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#")).map((line) => {
  const separator = line.indexOf("=");
  return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")];
}));

const apiKey = env.ELEVENLABS_API_KEY;
const voiceId = env.ELEVENLABS_VOICE_ID;
if (!apiKey || !voiceId) throw new Error("Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in near-demo/.env");

const cues = [
  ["That’s why we built NEAR. The name stands for New Encounter and Renewal. It’s a desktop faith companion that helps you make time for God.", "meet-near-01.mp3"],
  ["NEAR lives in a little notch at the top of your screen.", "meet-near-02.mp3"],
  ["Open NEAR right over what you’re working on. Your apps stay open, and today’s Bible verse is right there.", "meet-near-03.mp3"],
  ["Let’s take a moment to read a verse and reflect on it.", "meet-near-04.mp3"],
];

const audioDir = join(projectDir, "public", "audio");
await mkdir(audioDir, { recursive: true });
for (const [text, filename] of cues) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.58, similarity_boost: 0.78, style: 0.16, use_speaker_boost: true, speed: 0.9 },
    }),
  });
  if (!response.ok) throw new Error(`ElevenLabs request failed for ${filename} with HTTP ${response.status}: ${await response.text()}`);
  await writeFile(join(audioDir, filename), Buffer.from(await response.arrayBuffer()));
  console.log(`Generated public/audio/${filename}`);
}
