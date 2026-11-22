export const NOTE_MICROPHONE_KEY = "near.notes.microphone";

export function loadNoteMicrophone(): string {
  return localStorage.getItem(NOTE_MICROPHONE_KEY) ?? "";
}

export function saveNoteMicrophone(deviceId: string): void {
  localStorage.setItem(NOTE_MICROPHONE_KEY, deviceId);
}
