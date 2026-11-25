import { getDatabase } from "./db";
import { dateKey } from "./calendarTime";
import { BIBLE_BOOK_NAMES, type BiblePassage } from "./bibleReferences";
import type { ScriptureReference } from "./scripture";

export type Reflection = { id: number; canonical_book_id: number; chapter: number; verse_start: number; verse_end: number; translation: "ASV"; answer_says: string; answer_learn: string; answer_apply: string; created_at: string; updated_at: string };
export type Goal = { id: number; title: string; description: string; frequency: "once" | "daily" | "weekdays"; weekdays: number[]; preferred_time: string | null; reminder_enabled: number; status: "active" | "paused" | "archived"; created_at: string; updated_at: string };
export type GoalDraft = Pick<Goal, "title" | "description" | "frequency" | "weekdays" | "preferred_time" | "reminder_enabled">;
export type Checkin = { id: number; goal_id: number; reflection_id: number | null; completed_at: string; note: string; reflection_label: string | null };
const maxText = 10000;

function validateText(value: string, max = maxText) {
  if (typeof value !== "string") throw new Error("Enter text using plain text fields.");
  if (value.length > max) throw new Error(`Keep this under ${max.toLocaleString()} characters.`);
}

export async function listReflections(): Promise<Reflection[]> {
  return (await getDatabase()).select("SELECT * FROM scripture_reflections ORDER BY updated_at DESC,id DESC");
}

export async function getReflection(id: number): Promise<Reflection | null> {
  return (await getDatabase()).select<Reflection[]>("SELECT * FROM scripture_reflections WHERE id=$1", [id]).then(rows => rows[0] ?? null);
}

export async function saveReflection(reference: ScriptureReference, answers: { says: string; learn: string; apply: string }, id?: number): Promise<number> {
  Object.values(answers).forEach(value => validateText(value));
  if (reference.translation !== "ASV" || !Number.isInteger(reference.book) || reference.book < 1 || reference.book > BIBLE_BOOK_NAMES.length
    || !Number.isInteger(reference.chapter) || reference.chapter < 1 || reference.chapter > 150
    || !Number.isInteger(reference.verse) || reference.verse < 1 || reference.verse > 176
    || !Number.isInteger(reference.endVerse) || reference.endVerse < reference.verse || reference.endVerse > 176) throw new Error("This reflection needs a verified ASV reference.");
  const db = await getDatabase();
  const now = new Date().toISOString();
  const values = [reference.book, reference.chapter, reference.verse, reference.endVerse, "ASV", answers.says, answers.learn, answers.apply];
  if (id !== undefined) {
    await db.execute("UPDATE scripture_reflections SET canonical_book_id=$1,chapter=$2,verse_start=$3,verse_end=$4,translation=$5,answer_says=$6,answer_learn=$7,answer_apply=$8,updated_at=$9 WHERE id=$10", [...values, now, id]);
    return id;
  }
  const inserted = await db.execute("INSERT INTO scripture_reflections(canonical_book_id,chapter,verse_start,verse_end,translation,answer_says,answer_learn,answer_apply,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)", [...values, now]);
  if (inserted.lastInsertId === undefined) throw new Error("Could not save the reflection.");
  return inserted.lastInsertId;
}

export async function deleteReflection(id: number) { await (await getDatabase()).execute("DELETE FROM scripture_reflections WHERE id=$1", [id]); }
export async function listGoals(includeArchived = false): Promise<Goal[]> {
  const rows = await (await getDatabase()).select<(Omit<Goal, "weekdays"> & { weekdays: string })[]>(`SELECT * FROM faith_goals ${includeArchived ? "" : "WHERE status!='archived'"} ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, updated_at DESC`);
  return rows.map(row => ({ ...row, weekdays: parseWeekdays(row.weekdays) }));
}
function parseWeekdays(value: string): number[] { try { const days = JSON.parse(value); return Array.isArray(days) ? days.filter(day => Number.isInteger(day) && day >= 0 && day <= 6) : []; } catch { return []; } }
export async function saveGoal(goal: GoalDraft, id?: number): Promise<number> {
  const title = goal.title.trim();
  if (!title || title.length > 160) throw new Error("Enter a goal title of up to 160 characters.");
  validateText(goal.description, 2000);
  if (!["once", "daily", "weekdays"].includes(goal.frequency)) throw new Error("Choose a valid goal frequency.");
  if (!Array.isArray(goal.weekdays)) throw new Error("Choose valid weekdays.");
  if (goal.reminder_enabled !== 0 && goal.reminder_enabled !== 1) throw new Error("Choose whether reminders are enabled.");
  const weekdays = [...new Set(goal.weekdays)].filter(day => Number.isInteger(day) && day >= 0 && day <= 6).sort();
  if (goal.frequency === "weekdays" && !weekdays.length) throw new Error("Choose at least one weekday.");
  if (goal.preferred_time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(goal.preferred_time)) throw new Error("Choose a valid local time.");
  if (goal.reminder_enabled && !goal.preferred_time) throw new Error("Set a preferred time to turn on reminders.");
  const db = await getDatabase(); const now = new Date().toISOString();
  const values = [title, goal.description.trim(), goal.frequency, JSON.stringify(weekdays), goal.preferred_time, goal.reminder_enabled ? 1 : 0];
  if (id !== undefined) { await db.execute("UPDATE faith_goals SET title=$1,description=$2,frequency=$3,weekdays=$4,preferred_time=$5,reminder_enabled=$6,updated_at=$7 WHERE id=$8", [...values, now, id]); return id; }
  const result = await db.execute("INSERT INTO faith_goals(title,description,frequency,weekdays,preferred_time,reminder_enabled,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$7)", [...values, now]);
  if (result.lastInsertId === undefined) throw new Error("Could not save the goal."); return result.lastInsertId;
}
export async function setGoalStatus(id: number, status: Goal["status"]) { await (await getDatabase()).execute("UPDATE faith_goals SET status=$1,updated_at=$2 WHERE id=$3", [status, new Date().toISOString(), id]); }
export async function deleteGoal(id: number) { await (await getDatabase()).execute("DELETE FROM faith_goals WHERE id=$1", [id]); }
export async function addCheckin(goalId: number, reflectionId: number | null, note: string): Promise<void> {
  validateText(note, 2000);
  await (await getDatabase()).execute("INSERT INTO faith_checkins(goal_id,reflection_id,completed_at,note) SELECT $1,$2,$3,$4 WHERE EXISTS(SELECT 1 FROM faith_goals WHERE id=$1)", [goalId, reflectionId, new Date().toISOString(), note.trim()]);
}
export async function listCheckins(goalId: number): Promise<Checkin[]> {
  const rows = await (await getDatabase()).select<(Omit<Checkin, "reflection_label"> & { canonical_book_id: number | null; chapter: number | null; verse_start: number | null; verse_end: number | null })[]>("SELECT c.*,r.canonical_book_id,r.chapter,r.verse_start,r.verse_end FROM faith_checkins c LEFT JOIN scripture_reflections r ON r.id=c.reflection_id WHERE c.goal_id=$1 ORDER BY c.completed_at DESC,c.id DESC", [goalId]);
  return rows.map(row => ({ ...row, reflection_label: row.canonical_book_id && row.chapter && row.verse_start
    ? `${BIBLE_BOOK_NAMES[row.canonical_book_id - 1]} ${row.chapter}:${row.verse_start}${row.verse_end && row.verse_end !== row.verse_start ? `–${row.verse_end}` : ""}` : null }));
}
export async function countCheckinsThisWeek(goalId: number): Promise<number> {
  const [row] = await (await getDatabase()).select<{ count: number }[]>("SELECT COUNT(*) AS count FROM faith_checkins WHERE goal_id=$1 AND completed_at >= $2", [goalId, new Date(Date.now() - 7 * 86400000).toISOString()]); return row?.count ?? 0;
}
export async function dueFaithReminders(now = new Date()): Promise<Goal[]> {
  const goals = await listGoals(); const due: Goal[] = []; const date = dateKey(now);
  const db = await getDatabase();
  for (const goal of goals) {
    if (goal.status !== "active" || !goal.reminder_enabled || !goal.preferred_time) continue;
    if (goal.frequency === "once") {
      const [completed] = await db.select<{ count: number }[]>("SELECT COUNT(*) AS count FROM faith_checkins WHERE goal_id=$1", [goal.id]);
      if ((completed?.count ?? 0) > 0) continue;
    } else {
      const checkins=await db.select<{completed_at:string}[]>("SELECT completed_at FROM faith_checkins WHERE goal_id=$1",[goal.id]);
      if(checkins.some(checkin=>new Date(checkin.completed_at).toDateString()===now.toDateString()))continue;
    }
    if (goal.frequency === "weekdays" && !goal.weekdays.includes(now.getDay())) continue;
    const [hour, minute] = goal.preferred_time.split(":").map(Number);
    if (now.getHours() * 60 + now.getMinutes() < hour * 60 + minute) continue;
    const reminderDate=goal.frequency==="once"?"once":date;
    const prior = await db.select<{ goal_id: number }[]>("SELECT goal_id FROM faith_reminder_state WHERE goal_id=$1 AND local_date=$2", [goal.id, reminderDate]);
    if (prior.length) continue;
    const inserted=await db.execute("INSERT OR IGNORE INTO faith_reminder_state(goal_id,local_date,notified_at) VALUES($1,$2,$3)", [goal.id, reminderDate, now.toISOString()]);
    if(inserted.rowsAffected>0)due.push(goal);
  }
  return due;
}
export function referenceFromReflection(reflection: Reflection): BiblePassage { return { book: reflection.canonical_book_id, chapter: reflection.chapter, verse: reflection.verse_start, endVerse: reflection.verse_end }; }
