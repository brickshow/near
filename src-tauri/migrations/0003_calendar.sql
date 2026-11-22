ALTER TABLE events ADD COLUMN reminder_minutes INTEGER NOT NULL DEFAULT 15;
CREATE INDEX IF NOT EXISTS idx_events_starts ON events(starts_at);
CREATE TABLE IF NOT EXISTS event_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    starts_at TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('before','start')),
    delivered INTEGER NOT NULL DEFAULT 0,
    dismissed INTEGER NOT NULL DEFAULT 0,
    snooze_until INTEGER NOT NULL DEFAULT 0,
    UNIQUE(event_id, starts_at, kind)
);
