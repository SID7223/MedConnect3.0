-- V4 — Logbook tables (port of the Vercel /api/logbook contract).
--
-- MUST be V4, not V2: V1..V3 already applied on deployed databases, and
-- Flyway refuses out-of-order versions by default. Every statement is
-- IF NOT EXISTS / ON CONFLICT-safe so a redeploy over a database that ran
-- the legacy ensureLogbookTables() DDL is a no-op.

CREATE TABLE IF NOT EXISTS logbook_entries (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'procedure',
  title      TEXT NOT NULL,
  detail     TEXT DEFAULT '',
  status     TEXT DEFAULT '',
  date       DATE,
  time       TEXT DEFAULT '',
  notes      TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_logbook_user_kind
  ON logbook_entries(user_id, kind, date DESC);

CREATE TABLE IF NOT EXISTS logbook_targets (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill   TEXT NOT NULL,
  target  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, skill)
);
