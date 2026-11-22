export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function localDateTime(value: string): string {
  const date = new Date(value);
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
export function monthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1, 12);
  return Array.from({ length: 42 }, (_, index) => new Date(year, month, 1 - first.getDay() + index, 12));
}
export function dueReminder(event: { starts_at: string; reminder_minutes: number }, now: number): "before" | null {
  const starts = Date.parse(event.starts_at);
  if (!Number.isFinite(starts) || event.reminder_minutes < 0) return null;
  if (now >= starts) return null;
  if (event.reminder_minutes > 0 && now >= starts - event.reminder_minutes * 60_000) return "before";
  return null;
}
