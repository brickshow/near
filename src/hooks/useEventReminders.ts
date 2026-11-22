import { useEffect } from "react";
import { pollUpcomingReminder } from "../lib/calendar";
import { loadReminderPreferences } from "../lib/reminderPreferences";

export function useEventReminders(enabled: boolean, onReminder: () => void) {
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer = 0;
    let first = true;
    const check = async () => {
      try {
        const preferences = loadReminderPreferences();
        const alert = await pollUpcomingReminder({ repeatMinutes: preferences.repeatMinutes, resetOnOpen: first });
        first = false;
        if (alert && active) {
          onReminder();
        }
      } catch (error) { console.error("Calendar reminder check failed", error); }
      finally { if (active) timer = window.setTimeout(check, 10_000); }
    };
    void check();
    return () => { active = false; window.clearTimeout(timer); };
  }, [enabled, onReminder]);
}
