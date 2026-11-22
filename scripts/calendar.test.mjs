import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function setup() {
  const database = new DatabaseSync(':memory:');
  for (const file of ['0001_initial.sql', '0002_chat_conversations.sql', '0003_calendar.sql']) database.exec(readFileSync(new URL(`../src-tauri/migrations/${file}`, import.meta.url), 'utf8'));
  const parameters = values => Object.fromEntries(values.map((value, index) => [`$${index + 1}`, value]));
  const db = {
    select: async (sql, values = []) => database.prepare(sql).all(parameters(values)),
    execute: async (sql, values = []) => { const result = database.prepare(sql).run(parameters(values)); return { rowsAffected: Number(result.changes), lastInsertId: Number(result.lastInsertRowid) }; },
  };
  const cache = {};
  const calls = [], timers = [];
  let cleanup;
  let failPopup = false;
  function load(name) {
    if (cache[name]) return cache[name];
    const exports = {}; cache[name] = exports;
    const path = name === 'useEventReminders' ? 'hooks' : 'lib';
    const source = ts.transpileModule(readFileSync(new URL(`../src/${path}/${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    runInNewContext(source, { exports, Date, console: { error() {} }, window: { setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout: id => { timers[id - 1] = undefined; } }, require(id) {
      if (id === './db' || id === '../lib/db') return { getDatabase: async () => db };
      if (id === '../lib/calendar') return load('calendar');
      if (id === 'react') return { useEffect: callback => { cleanup = callback(); } };
      if (id === '@tauri-apps/api/core') return { invoke: async command => { calls.push(command); if (failPopup) throw Error('Window creation failed'); } };
      if (id === '@tauri-apps/api/event') return { emit: async () => {} };
      return load(id.slice(2));
    } });
    return exports;
  }
  return { calendar: load('calendar'), time: load('calendarTime'), database, calls,
    start: () => load('useEventReminders').useEventReminders(true),
    stop: () => cleanup?.(),
    fail: value => { failPopup = value; },
    nextPoll: async () => { const callback = timers.pop(); if (callback) await callback(); },
  };
}
const event = { title: 'Calendar test', starts_at: '2030-06-10T09:00:00.000Z', location: 'Home', notes: 'Saved notes', reminder_minutes: 15 };
test('reminds 15 minutes before and at the event, once for each stage', async () => {
  const { calendar: c, database } = setup();
  await c.saveEvent(event);
  const start = Date.parse(event.starts_at);
  await c.queueReminders(start - 900001);
  assert.equal((await c.listAlerts(start)).length, 0);
  await c.queueReminders(start - 900000);
  let rows = await c.listAlerts(start);
  assert.equal(rows.length, 1); assert.equal(rows[0].kind, 'before');
  await c.dismissAlert(rows[0].alert_id);
  await c.queueReminders(start - 1);
  assert.equal((await c.listAlerts(start)).length, 0);
  await c.queueReminders(start);
  await c.queueReminders(start + 10000);
  rows = await c.listAlerts(start);
  assert.equal(rows.length, 1); assert.equal(rows[0].kind, 'start');
  await c.dismissAlert(rows[0].alert_id);
  await c.queueReminders(start + 86400000);
  assert.equal((await c.listAlerts(start + 86400000)).length, 0);
  database.close();
});
test('snooze, reschedule, disable and delete do not leave stale alerts', async () => {
  const { calendar: c, database } = setup();
  const past = { ...event, starts_at: new Date(Date.now() - 1000).toISOString() };
  await c.saveEvent(past); await c.queueReminders();
  let rows = await c.listAlerts();
  const id = rows[0].id;
  await c.dismissAlert(rows[0].alert_id, true);
  assert.equal((await c.listAlerts(Date.now() + 590000)).length, 0);
  assert.equal((await c.listAlerts(Date.now() + 610000)).length, 1);
  await c.saveEvent(event, id); await c.queueReminders();
  assert.equal((await c.listAlerts()).length, 0);
  await c.saveEvent({ ...past, reminder_minutes: -1 }, id); await c.queueReminders();
  assert.equal((await c.listAlerts()).length, 0);
  await c.saveEvent(past, id); await c.queueReminders();
  assert.equal((await c.listAlerts()).length, 1);
  await c.deleteEvent(id); await c.queueReminders();
  assert.equal((await c.listAlerts()).length, 0);
  database.close();
});
test('restart after event time produces one missed alert, not two', async () => {
  const { calendar: c, database } = setup();
  await c.saveEvent(event);
  const now = Date.parse(event.starts_at) + 300000;
  await c.queueReminders(now);
  const rows = await c.listAlerts(now);
  assert.equal(rows.length, 1); assert.equal(rows[0].kind, 'start');
  assert.equal((await c.listEvents())[0].notes, event.notes);
  database.close();
});
test('calendar grid covers leap day and date keys use local calendar dates', () => {
  const { time, database } = setup();
  const days = time.monthDays(2028, 1);
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 0);
  assert.ok(days.some(day => time.dateKey(day) === '2028-02-29'));
  assert.equal(time.dateKey(new Date(2030, 5, 10, 0, 1)), '2030-06-10');
  database.close();
});

test('main-window scheduler shows alerts once and retries failed window delivery', async () => {
  const h = setup();
  await h.calendar.saveEvent({ ...event, starts_at: new Date(Date.now() - 1000).toISOString() });
  h.fail(true); h.start();
  await new Promise(setImmediate);
  assert.equal(h.calls[0], 'show_calendar_reminders');
  assert.equal(h.database.prepare('SELECT delivered FROM event_alerts').get().delivered, 0);
  h.fail(false); await h.nextPoll();
  assert.equal(h.database.prepare('SELECT delivered FROM event_alerts').get().delivered, 1);
  assert.equal(h.calls.length, 2);
  await h.nextPoll();
  assert.equal(h.calls.length, 2, 'polling must not repeatedly open a delivered reminder');
  h.stop(); h.database.close();
});
