CREATE TABLE IF NOT EXISTS player_saves (
  player_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  payload TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_saves_updated_at
  ON player_saves (updated_at DESC);
