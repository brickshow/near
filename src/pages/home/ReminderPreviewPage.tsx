import { useCallback, useEffect, useRef, useState } from "react";
import { listAlerts, type EventAlert } from "../../lib/calendar";
import { speakNear, stopNearVoice } from "../../lib/voice";
import { dateKey } from "../../lib/calendarTime";

type Props = { voiceName: string };

export function ReminderPreviewPage({ voiceName }: Props) {
  const [alerts, setAlerts] = useState<EventAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const spoken = useRef(new Set<number>());

  const refresh = async () => {
    try { setAlerts(await listAlerts()); setError(""); }
    catch (cause) { setError(String(cause)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const readReminder = useCallback((alert: EventAlert) => {
    const date = new Date(alert.starts_at);
    const day = eventDayLabel(date);
    const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const place = alert.location ? ` at ${alert.location}` : "";
    const spokenText = Date.parse(alert.starts_at) <= Date.now()
      ? `Hey brother, this is a reminder about ${alert.title}, scheduled ${day} at ${time}${place}.`
      : `Hey brother, you have ${alert.title} ${day} at ${time}${place}.`;
    speakNear(spokenText, voiceName, { rate: 0.95 });
  }, [voiceName]);

  useEffect(() => {
    const next = alerts.find(alert => !spoken.current.has(alert.alert_id));
    if (next) {
      spoken.current.add(next.alert_id);
      readReminder(next);
    }
    return () => stopNearVoice();
  }, [alerts, readReminder]);

  return <section className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 overflow-hidden px-5 py-2 text-center text-[#edf4f6]" aria-label="Event reminders">
    {error && <p className="m-0 text-[9px] text-[#ff9c8f]" role="alert">{error}</p>}
    <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden" aria-live="polite">
      {loading ? <p className="text-[10px] text-[#aab7c4]" role="status">Loading reminders...</p> : alerts.length === 0 ? <p className="text-[10px] text-[#aab7c4]">No reminders.</p> : (() => {
        const alert = alerts[0];
        return <div key={alert.alert_id} className="mx-auto flex w-full max-w-[460px] flex-col items-center justify-center px-4 text-center">
          <p className="mb-0.5 mt-0 text-[11px] leading-tight text-[#aab7c4]">Hey brother, you have</p>
          <h2 className="m-0 max-w-full break-words text-[15px] font-semibold leading-snug">{alert.title} {reminderDayLabel(new Date(alert.starts_at))}.</h2>
          <time className="mt-1.5 max-w-full text-[10px] leading-tight text-[#aab7c4]" dateTime={alert.starts_at}>{new Date(alert.starts_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {new Date(alert.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
          {alert.location && <p className="my-1 max-w-full break-words text-[10px] leading-tight text-[#aab7c4]">{alert.location}</p>}
        </div>;
      })()}
    </div>
  </section>;
}

function eventDayLabel(date: Date) {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (dateKey(date) === dateKey(today)) return "today";
  if (dateKey(date) === dateKey(tomorrow)) return "tomorrow";
  return `on ${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`;
}

function reminderDayLabel(date: Date) {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (dateKey(date) === dateKey(today)) return "today";
  if (dateKey(date) === dateKey(tomorrow)) return "tomorrow";
  return "coming up";
}
