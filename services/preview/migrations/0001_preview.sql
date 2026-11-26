CREATE TABLE preview_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  activations_enabled INTEGER NOT NULL CHECK (activations_enabled IN (0, 1))
);
INSERT INTO preview_config VALUES (1, 1);
CREATE TABLE preview_activations (
  token_hash TEXT PRIMARY KEY,
  activated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL DEFAULT (unixepoch() + 259200),
  CHECK (expires_at - activated_at = 259200)
);
