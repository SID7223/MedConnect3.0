-- V9 — One-liner case engine (ST7c): rotation of many cases per type.
--
-- daily_items was one row per (type, scheduled_date) — fine for a daily
-- term/drill, impossible for 1000+ rotating one-liner cases. This drops
-- that limit and keys bulk-loaded content by external_id (the slug the
-- CSV/upsert carries) instead. scheduled_date becomes the release date:
-- items only surface once scheduled_date <= today.
--
-- daily_answers records the user's differential entries per case so the
-- rotation can serve UNANSWERED cases first (specialty-biased) and the
-- recommendation engine can label what the user already tried.

ALTER TABLE daily_items DROP CONSTRAINT IF EXISTS daily_items_type_scheduled_date_key;

ALTER TABLE daily_items ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_daily_items_type_status
  ON daily_items(type, status, scheduled_date);

CREATE TABLE IF NOT EXISTS daily_answers (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     INTEGER NOT NULL REFERENCES daily_items(id) ON DELETE CASCADE,
  entries     JSONB NOT NULL DEFAULT '[]'::jsonb,
  answered_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_daily_answers_user ON daily_answers(user_id, item_id);
