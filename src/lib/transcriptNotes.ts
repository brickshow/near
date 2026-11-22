import { getDatabase } from "./db";

export async function saveTranscriptNote(transcript: string): Promise<void> {
  const content = transcript.trim();
  if (!content) throw new Error("There is no transcript to save.");
  const database = await getDatabase();
  await database.execute(
    "INSERT INTO notes (title, content) VALUES ($1, $2)",
    ["Voice transcript", content],
  );
}
