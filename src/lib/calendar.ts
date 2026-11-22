import { emit } from "@tauri-apps/api/event";
import { getDatabase } from "./db";
import { dueReminder } from "./calendarTime";

export type CalendarEvent = { id: number; title: string; starts_at: string; location: string; notes: string; reminder_minutes: number };
export type EventAlert = CalendarEvent & { alert_id: number; kind: "before" | "start" };
export const calendarChanged = () => emit("near://calendar-changed").catch(() => {});
export async function listEvents(): Promise<CalendarEvent[]> {
  return (await getDatabase()).select("SELECT * FROM events ORDER BY starts_at, id");
}
export async function saveEvent(event: Omit<CalendarEvent, "id">, id?: number) {
  if (!event.title.trim() || !Number.isFinite(Date.parse(event.starts_at))) throw Error("Enter a title and valid date/time.");
  const db = await getDatabase();
  const values = [event.title.trim(), event.starts_at, event.location.trim(), event.notes, event.reminder_minutes];
  if (id !== undefined) {
    await db.execute("UPDATE events SET title=$1, starts_at=$2, location=$3, notes=$4, reminder_minutes=$5 WHERE id=$6", [...values, id]);
  } else {
    await db.execute("INSERT INTO events(title,starts_at,location,notes,reminder_minutes) VALUES($1,$2,$3,$4,$5)", values);
  }
  await calendarChanged();
}
export async function deleteEvent(id: number) {
  await (await getDatabase()).execute("DELETE FROM events WHERE id=$1", [id]);
  await calendarChanged();
}
export async function queueReminders(now = Date.now()): Promise<void> {
  const db = await getDatabase();
  // Ignore orphaned, rescheduled, disabled, and already-started events.
  await db.execute("DELETE FROM event_alerts WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.id=event_alerts.event_id AND e.starts_at=event_alerts.starts_at AND e.reminder_minutes>=0)");
  for (const event of await listEvents()) {
    const kind = dueReminder(event, now);
    if (!kind) continue;
    await db.execute("INSERT OR IGNORE INTO event_alerts(event_id,starts_at,kind) SELECT id,starts_at,$3 FROM events WHERE id=$1 AND starts_at=$2 AND reminder_minutes>=0", [event.id, event.starts_at, kind]);
  }
}

export async function pollUpcomingReminder(options: { now?: number; repeatMinutes: number; resetOnOpen?: boolean }): Promise<EventAlert | null> {
  const now = options.now ?? Date.now();
  const nowIso = new Date(now).toISOString();
  const db = await getDatabase();
  if (options.resetOnOpen) {
    await db.execute("UPDATE event_alerts SET last_notified_at=0 WHERE dismissed=0 AND starts_at>$1", [nowIso]);
  }
  await queueReminders(now);
  const alert = (await db.select<EventAlert[]>(
    "SELECT e.*, a.id AS alert_id, a.kind FROM event_alerts a JOIN events e ON e.id=a.event_id AND e.starts_at=a.starts_at WHERE a.dismissed=0 AND a.snooze_until<=$1 AND a.last_notified_at<=$2 AND e.starts_at>$3 AND e.reminder_minutes>0 ORDER BY e.starts_at, a.id LIMIT 1",
    [now, now - options.repeatMinutes * 60_000, nowIso],
  ))[0];
  if (!alert) return null;
  await db.execute("UPDATE event_alerts SET last_notified_at=$2 WHERE id=$1", [alert.alert_id, now]);
  return alert;
}

export async function listAlerts(now = Date.now()): Promise<EventAlert[]> {
  return (await getDatabase()).select("SELECT e.*, a.id AS alert_id, a.kind FROM event_alerts a JOIN events e ON e.id=a.event_id AND e.starts_at=a.starts_at WHERE a.dismissed=0 AND a.snooze_until<=$1 AND e.starts_at>$2 AND e.reminder_minutes>0 ORDER BY e.starts_at", [now, new Date(now).toISOString()]);
}
export async function dismissAlert(id: number, snooze = false) {
  const db = await getDatabase();
  await db.execute(snooze ? "UPDATE event_alerts SET snooze_until=$2,delivered=0 WHERE id=$1" : "UPDATE event_alerts SET dismissed=1 WHERE id=$1", snooze ? [id, Date.now() + 600_000] : [id]);
  await calendarChanged();
}
