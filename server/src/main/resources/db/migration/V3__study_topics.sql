-- V3 — study topics for the Progress Tracker (My Study tab).
--
-- User-created topics with a name, optional study window, a fixed palette
-- color id (c1..c6, same convention as study_blocks.color) and a progress
-- percentage. Progress is client-reported for now (0 by default); real
-- computation lands in a follow-up ticket. Idempotent, like V1/V2.

CREATE TABLE IF NOT EXISTS study_topics (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  subtitle   TEXT DEFAULT '',
  start_date DATE,
  end_date   DATE,
  color      TEXT NOT NULL DEFAULT 'c1',
  progress   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_topics_user ON study_topics(user_id);
