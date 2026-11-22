import { getDatabase } from "./db";
export type Note = { id: number; title: string; content: string; updated_at: string };
export async function listNotes(): Promise<Note[]> {
  return (await getDatabase()).select("SELECT id,title,content,updated_at FROM notes ORDER BY updated_at DESC,id DESC");
}
export async function saveNote(title: string, content: string, id?: number): Promise<number> {
  if (!title.trim()) throw Error("Give your note a title.");
  const db = await getDatabase();
  if (id !== undefined) {
    await db.execute("UPDATE notes SET title=$1,content=$2,updated_at=$3 WHERE id=$4", [title.trim(), content, new Date().toISOString(), id]);
    return id;
  }
  const result = await db.execute("INSERT INTO notes(title,content,updated_at) VALUES($1,$2,$3)", [title.trim(), content, new Date().toISOString()]);
  if (result.lastInsertId === undefined) throw Error("Could not save the note.");
  return result.lastInsertId;
}
export async function deleteNote(id: number) {
  await (await getDatabase()).execute("DELETE FROM notes WHERE id=$1", [id]);
}
