CREATE TABLE IF NOT EXISTS scripture_reflections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    canonical_book_id INTEGER NOT NULL CHECK(canonical_book_id BETWEEN 1 AND 66),
    chapter INTEGER NOT NULL CHECK(chapter BETWEEN 1 AND 150),
    verse_start INTEGER NOT NULL CHECK(verse_start BETWEEN 1 AND 176),
    verse_end INTEGER NOT NULL CHECK(verse_end BETWEEN verse_start AND 176),
    translation TEXT NOT NULL DEFAULT 'ASV' CHECK(translation = 'ASV'),
    answer_says TEXT NOT NULL DEFAULT '',
    answer_learn TEXT NOT NULL DEFAULT '',
    answer_apply TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reflections_updated ON scripture_reflections(updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_reflections_scripture ON scripture_reflections(canonical_book_id, chapter, verse_start, verse_end);

CREATE TABLE IF NOT EXISTS faith_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),
    description TEXT NOT NULL DEFAULT '',
    frequency TEXT NOT NULL CHECK(frequency IN ('once','daily','weekdays')),
    weekdays TEXT NOT NULL DEFAULT '[]',
    preferred_time TEXT,
    reminder_enabled INTEGER NOT NULL DEFAULT 0 CHECK(reminder_enabled IN (0,1)),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_faith_goals_status ON faith_goals(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS faith_checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL REFERENCES faith_goals(id) ON DELETE CASCADE,
    reflection_id INTEGER REFERENCES scripture_reflections(id) ON DELETE SET NULL,
    completed_at TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_faith_checkins_goal ON faith_checkins(goal_id, completed_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS faith_reminder_state (
    goal_id INTEGER NOT NULL REFERENCES faith_goals(id) ON DELETE CASCADE,
    local_date TEXT NOT NULL,
    notified_at TEXT NOT NULL,
    PRIMARY KEY(goal_id, local_date)
);
