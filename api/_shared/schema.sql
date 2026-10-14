-- MedConnect 2.0 — Neon Postgres schema
-- Run this once in the Neon SQL editor (neon.tech -> your project -> SQL Editor),
-- or paste it into a query. Safe to re-run (uses IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  exam          TEXT DEFAULT '',
  country       TEXT DEFAULT '',
  attempt       TEXT DEFAULT '1st sitting',
  timezone      TEXT DEFAULT '',
  question_bank TEXT DEFAULT '',
  study_time    TEXT DEFAULT '',
  profile_complete BOOLEAN DEFAULT FALSE,
  pro_active    BOOLEAN DEFAULT FALSE,
  avatar        TEXT DEFAULT '🩺',
  exam_date     DATE,
  reg_council   TEXT DEFAULT '',
  reg_number    TEXT DEFAULT '',
  last_seen     TIMESTAMPTZ DEFAULT now(),
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_study_day TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS connections (
  id          SERIAL PRIMARY KEY,
  requester   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (requester, recipient)
);

CREATE INDEX IF NOT EXISTS idx_users_exam ON users(exam);
CREATE INDEX IF NOT EXISTS idx_conn_requester ON connections(requester);
CREATE INDEX IF NOT EXISTS idx_conn_recipient ON connections(recipient);

CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  sender      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msg_pair ON messages(sender, recipient);

CREATE TABLE IF NOT EXISTS blocks (
  id         SERIAL PRIMARY KEY,
  blocker    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (blocker, blocked)
);

CREATE TABLE IF NOT EXISTS reports (
  id          SERIAL PRIMARY KEY,
  reporter    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favourite_quotes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote_id   INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, quote_id)
);

CREATE TABLE IF NOT EXISTS reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reset_token ON reset_tokens(token);

-- ===== Group study chats =====
CREATE TABLE IF NOT EXISTS groups (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  creator    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS group_members (
  id        SERIAL PRIMARY KEY,
  group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, user_id)
);
CREATE TABLE IF NOT EXISTS group_messages (
  id         SERIAL PRIMARY KEY,
  group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gm_group ON group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_gmem_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_gmem_user ON group_members(user_id);

