-- V6 — Study goals + daily minutes (ST4 Tracker My Study).
--
-- study_goals: one row per user (daily target in minutes, 30..720 in
-- 15-min steps enforced client-side; days_per_week optional; reminder_time
-- HH:MM local, empty = no reminder). study_minutes: one row per (user, day).

CREATE TABLE IF NOT EXISTS study_goals (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  daily_minutes  INTEGER NOT NULL DEFAULT 0,
  days_per_week  INTEGER NOT NULL DEFAULT 0,
  reminder_time  TEXT DEFAULT '',
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS study_minutes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     DATE NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS idx_study_minutes_user_day ON study_minutes(user_id, day DESC);
