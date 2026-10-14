-- V7 — Daily practice content (ST7: term / drill / one-liner).
--
-- One row per (type, scheduled_date). content is JSONB shaped per type
-- (see Daily.kt); source/reviewer/reviewed_on are REQUIRED before status
-- may become 'approved'. Client falls back to the most recent unused item
-- when a date has no row, so gaps never render an empty card.

CREATE TABLE IF NOT EXISTS daily_items (
  id             SERIAL PRIMARY KEY,
  type           TEXT NOT NULL CHECK (type IN ('term', 'drill', 'one-liner')),
  scheduled_date DATE NOT NULL,
  specialty     TEXT DEFAULT '',
  content        JSONB NOT NULL DEFAULT '{}'::jsonb,
  source         TEXT DEFAULT '',
  reviewer       TEXT DEFAULT '',
  reviewed_on    DATE,
  status         TEXT NOT NULL DEFAULT 'draft',
  UNIQUE (type, scheduled_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_items_date ON daily_items(scheduled_date DESC);

CREATE TABLE IF NOT EXISTS daily_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES daily_items(id) ON DELETE CASCADE,
  done    BOOLEAN NOT NULL DEFAULT TRUE,
  done_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
