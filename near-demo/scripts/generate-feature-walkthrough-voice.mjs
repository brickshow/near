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
  "Let’s start with voice. If I’m between tasks and want a moment to pause, I can talk to NEAR right from my desktop. I hold N and ask.",
  "If I’m somewhere quiet, I can type instead. Here, I’ll ask NEAR for a question I can reflect on after reading the passage.",
  "I can also open the Bible directly. I’ll pick a passage and press the read-aloud control. When I want to slow down and listen, NEAR can read the passage to me.",
  "In Journey, I can create a personal goal for my walk with God. I’ll set one I can actually follow this week.",
  "When a passage gives me something I want to remember, I can write it down in Notes. I’ll add a short reflection and include the verse reference. Later, I can click that reference right from my note and open it again.",
  "If I’m already listening to worship music, I can control it right here in NEAR. I can pause the song and pick up where I left off.",
  "Church gives me one place to see my church activities. I can open the calendar, check what’s coming up, and see the details for something I planned.",
  "Here’s one more thing. I can start a worship song by asking NEAR out loud. Play music, Nothing Is Impossible by Planetshakers.",
];

const audioDir = join(projectDir, "public", "audio");
const selected = new Set(process.argv.slice(2).map(Number).filter((number) => Number.isInteger(number) && number >= 1 && number <= cues.length));
await mkdir(audioDir, { recursive: true });
for (const [index, text] of cues.entries()) {
  if (selected.size && !selected.has(index + 1)) continue;
  const filename = `near-feature-${String(index + 1).padStart(2, "0")}-voice.mp3`;
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.58, similarity_boost: 0.78, style: 0.16, use_speaker_boost: true, speed: 0.9 },
    }),
  });
  if (!response.ok) throw new Error(`ElevenLabs request failed for ${filename} with HTTP ${response.status}`);
  await writeFile(join(audioDir, filename), Buffer.from(await response.arrayBuffer()));
  console.log(`Generated public/audio/${filename}`);
}
