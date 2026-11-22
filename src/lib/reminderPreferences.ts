export type ReminderPreferences = {
  repeatMinutes: number;
  closeAfterSeconds: number;
};

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  repeatMinutes: 5,
  closeAfterSeconds: 30,
};

const STORAGE_KEY = "near.reminders.preferences.v1";
const REPEAT_OPTIONS = [1, 3, 5, 10, 15];
const CLOSE_OPTIONS = [15, 30, 45, 60];

export function loadReminderPreferences(storage: Storage = localStorage): ReminderPreferences {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null") as Partial<ReminderPreferences> | null;
    return {
      repeatMinutes: REPEAT_OPTIONS.includes(value?.repeatMinutes ?? NaN) ? value!.repeatMinutes! : DEFAULT_REMINDER_PREFERENCES.repeatMinutes,
      closeAfterSeconds: CLOSE_OPTIONS.includes(value?.closeAfterSeconds ?? NaN) ? value!.closeAfterSeconds! : DEFAULT_REMINDER_PREFERENCES.closeAfterSeconds,
    };
  } catch {
    return DEFAULT_REMINDER_PREFERENCES;
  }
}

export function saveReminderPreferences(preferences: ReminderPreferences, storage: Storage = localStorage): ReminderPreferences {
  const saved = {
    repeatMinutes: REPEAT_OPTIONS.includes(preferences.repeatMinutes) ? preferences.repeatMinutes : DEFAULT_REMINDER_PREFERENCES.repeatMinutes,
    closeAfterSeconds: CLOSE_OPTIONS.includes(preferences.closeAfterSeconds) ? preferences.closeAfterSeconds : DEFAULT_REMINDER_PREFERENCES.closeAfterSeconds,
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return saved;
}
