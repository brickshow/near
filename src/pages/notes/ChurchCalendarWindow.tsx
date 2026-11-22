import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { listen } from "@tauri-apps/api/event";
import { listEvents, saveEvent, deleteEvent, type CalendarEvent } from "../../lib/calendar";
import { dateKey, localDateTime, monthDays } from "../../lib/calendarTime";
import { AppModal, type AppModalContent } from "../../components/AppModal";
import "./NotesWindow.css";

type Draft = { title: string; starts: string; location: string; notes: string; reminder: number; id?: number };
const blank = (day: string): Draft => ({ title: "", starts: `${day}T09:00`, location: "", notes: "", reminder: 15 });
const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function ChurchCalendarWindow() {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12));
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [all, setAll] = useState(false);
  const [showAllSelectedDay, setShowAllSelectedDay] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<AppModalContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const editor = useRef<HTMLDialogElement>(null);
  const editing = draft !== null;
  useEffect(() => { if (editing) editor.current?.showModal(); }, [editing]);
  useEffect(() => { if (error) setDialog({ title: "Calendar error", message: error }); }, [error]);
  useEffect(() => {
    let active = true;
    let stop: (() => void) | undefined;
    const refresh = () => void listEvents().then(rows => { if (active) { setEvents(rows); setError(""); } }).catch(cause => { if (active) setError(String(cause)); }).finally(() => { if (active) setLoading(false); });
    refresh();
    void listen("near://calendar-changed", refresh).then(dispose => { if (!active) dispose(); else stop = dispose; }).catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; stop?.(); };
  }, []);
  const matchingEvents = events.filter(event => (all || dateKey(new Date(event.starts_at)) === selected) && `${event.title} ${event.location} ${event.notes}`.toLowerCase().includes(search.toLowerCase()));
  const visible = !all && !showAllSelectedDay ? matchingEvents.slice(0, 3) : matchingEvents;
  const counts = new Map<string, number>();
  for (const event of events) { const key = dateKey(new Date(event.starts_at)); counts.set(key, (counts.get(key) ?? 0) + 1); }
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true); setError("");
    try {
      await saveEvent({ title: draft.title, starts_at: new Date(draft.starts).toISOString(), location: draft.location, notes: draft.notes, reminder_minutes: draft.reminder }, draft.id);
      setEvents(await listEvents()); setSelected(draft.starts.slice(0, 10)); const when = new Date(draft.starts); setMonth(new Date(when.getFullYear(), when.getMonth(), 1, 12)); setDraft(null);
      setDialog({ title: "Event saved", message: "The church event was saved on this device." });
    } catch (cause) { setError(String(cause)); }
    finally { setSaving(false); }
  };
  const edit = (event: CalendarEvent) => setDraft({ id: event.id, title: event.title, starts: localDateTime(event.starts_at), location: event.location, notes: event.notes, reminder: event.reminder_minutes });
  const remove = async (id: number) => {
    setRemoving(id); setError("");
    try { await deleteEvent(id); setEvents(await listEvents()); setDialog({ title: "Event deleted", message: "The church event was permanently deleted." }); }
    catch (cause) { setError(String(cause)); }
    finally { setRemoving(null); }
  };
  const changeMonth = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1, 12));
  return <main className="notes-window church-calendar-window docked-panel">
    <header className="notes-header"><div><h1>Church Calendar</h1><p>Plan services, gatherings, and other church events.</p></div><div className="notes-header-actions"><button className="notes-primary" onClick={() => setDraft(blank(selected))}>+ Add event</button><button aria-label="Close Church Calendar" onClick={() => void getCurrentWindow().close()}>&times;</button></div></header>
    <div className="notes-layout">
      <aside className="notes-calendar">
        <div className="notes-month"><button aria-label="Previous month" onClick={() => changeMonth(-1)}>&lsaquo;</button><h2>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2><button aria-label="Next month" onClick={() => changeMonth(1)}>&rsaquo;</button></div>
        <button className="notes-today" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1, 12)); setSelected(dateKey(now)); setAll(false); setShowAllSelectedDay(false); }}>Go to today</button>
        <div className="notes-weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <span key={day}>{day}</span>)}</div>
        <div className="notes-days" role="group" aria-label="Choose a calendar date">{monthDays(month.getFullYear(), month.getMonth()).map(day => {
          const key = dateKey(day); const count = counts.get(key) ?? 0;
          return <button key={key} className={`${day.getMonth() !== month.getMonth() ? "outside" : ""} ${key === dateKey(new Date()) ? "today" : ""}`} aria-pressed={selected === key && !all} aria-label={`${day.toLocaleDateString(undefined, { dateStyle: "full" })}, ${count} events`} onClick={() => { setSelected(key); setAll(false); setShowAllSelectedDay(false); }}><span>{day.getDate()}</span>{count > 0 && <i aria-hidden="true" />}</button>;
        })}</div>
        <div className="notes-reminder-info"><strong>Event reminders</strong><p>NEAR can remind you before an event. Reminders work while NEAR is running, even when this calendar is closed.</p><span>Times shown in {localTimeZone}</span></div>
      </aside>
      <section className="notes-agenda">
        <div className="notes-agenda-top"><div><h2>{all ? "All events" : new Date(`${selected}T12:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2><span>{matchingEvents.length === 0 ? "No events planned" : `${matchingEvents.length} ${matchingEvents.length === 1 ? "event" : "events"}${!all && matchingEvents.length > 3 && !showAllSelectedDay ? " · first 3 shown" : ""}`}</span></div><div className="notes-inline-actions"><button aria-pressed={all} onClick={() => { setAll(value => !value); setShowAllSelectedDay(false); }}>{all ? "Show selected day" : "Show all events"}</button>{!all && matchingEvents.length > 3 && <button aria-expanded={showAllSelectedDay} onClick={() => setShowAllSelectedDay(value => !value)}>{showAllSelectedDay ? "Show fewer" : `Show all ${matchingEvents.length}`}</button>}</div></div>
        <label className="church-event-search"><span>Find an event</span><input aria-label="Search church events" placeholder="Search by name, place, or details" value={search} onChange={event => setSearch(event.target.value)} /></label>
        {loading ? <p role="status">Loading your calendar...</p> : visible.length === 0 ? <div className="notes-empty"><h3>{search ? "No events found" : "Nothing planned for this day"}</h3><p>{search ? "Try a different word, or clear your search." : "Add a service or gathering and NEAR can remind you before it starts."}</p><button className="notes-primary" onClick={() => setDraft(blank(selected))}>{search ? "Add an event" : "Plan an event"}</button></div> : <div className="notes-event-list">{visible.map(event => <article key={event.id}>
          <div className="notes-event-time"><time dateTime={event.starts_at}>{new Date(event.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>{all && <span>{new Date(event.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>}</div>
          <div className="notes-event-body"><h3>{event.title}</h3>{event.location && <p>{event.location}</p>}{event.notes && <p className="notes-event-notes">{event.notes}</p>}<small>{event.reminder_minutes <= 0 ? "Reminders off" : `${event.reminder_minutes} minutes before`}</small>
          <div className="notes-inline-actions"><button onClick={() => edit(event)}>Edit</button><button disabled={removing !== null} onClick={() => setDialog({ title: "Delete event?", message: `Delete “${event.title}” permanently?`, confirmLabel: "Delete event", danger: true, onConfirm: () => void remove(event.id) })}>Delete</button></div></div>
        </article>)}</div>}
      </section>
    </div>
    {draft && <dialog ref={editor} className="notes-editor" aria-labelledby="event-editor-title" onCancel={event => { event.preventDefault(); if (!saving) setDraft(null); }}><form onSubmit={event => void submit(event)}>
      <h2 id="event-editor-title">{draft.id ? "Edit church event" : "Plan a church event"}</h2>
      <p className="church-editor-intro">Add the basic details below. You can change them later.</p>
      <label>What is the event?<input autoFocus required maxLength={160} placeholder="For example, Sunday service" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
      <label>When is it?<input required type="datetime-local" value={draft.starts} onChange={event => setDraft({ ...draft, starts: event.target.value })} /></label>
      <label>Where is it? <span className="church-field-optional">Optional</span><input maxLength={240} placeholder="Church name or address" value={draft.location} onChange={event => setDraft({ ...draft, location: event.target.value })} /></label>
      <label>Anything else to remember? <span className="church-field-optional">Optional</span><textarea rows={4} placeholder="Add a note about this event" maxLength={10000} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>
      <label>Reminder<select value={draft.reminder} onChange={event => setDraft({ ...draft, reminder: Number(event.target.value) })}><option value={15}>15 minutes before</option><option value={5}>5 minutes before</option><option value={30}>30 minutes before</option><option value={60}>1 hour before</option><option value={0}>No reminder</option><option value={-1}>No reminder</option></select></label>
      <p className="church-reminder-hint">NEAR will remind you before the event while the app is running.</p>
      <div className="notes-editor-actions"><button type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</button><button className="notes-primary" disabled={saving} type="submit">{saving ? "Saving event..." : draft.id ? "Save changes" : "Add event"}</button></div>
    </form></dialog>}
    {dialog && <AppModal {...dialog} onClose={() => setDialog(null)} />}
  </main>;
}
