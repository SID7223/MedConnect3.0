-- MedConnect — consolidated baseline schema.
--
-- Replaces the ad-hoc `CREATE TABLE IF NOT EXISTS` calls that were scattered
-- across the Vercel functions (profile.js `ensureDeckTables`/`ensureBlocksTable`/
-- `ensureQbankTables`/`ensureNotesTables`/`ensureSettingsTable`, messages.js for
-- message_reactions/message_reads, push.js for push_subs). Those ran DDL on the
-- request path; Flyway owns the schema instead.
--
-- Every statement is idempotent, so running this against the existing Neon
-- database is a no-op for tables and columns that already exist.

-- ===== Identity =====
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
  created_at    TIMESTAMPTZ DEFAULT now(),
  -- added at runtime by profile.js, never created in the original repo
  profession    TEXT DEFAULT 'medical',
  bio           TEXT DEFAULT '',
  medical_school TEXT DEFAULT '',
  focus         TEXT DEFAULT '',
  gender        TEXT DEFAULT '',
  study_styles  TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_users_exam ON users(exam);

-- ===== Study partners =====
CREATE TABLE IF NOT EXISTS connections (
  id          SERIAL PRIMARY KEY,
  requester   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (requester, recipient)
);
CREATE INDEX IF NOT EXISTS idx_conn_requester ON connections(requester);
CREATE INDEX IF NOT EXISTS idx_conn_recipient ON connections(recipient);

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

-- ===== Direct messages =====
CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  sender      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msg_pair ON messages(sender, recipient);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id   INTEGER NOT NULL,
  message_type TEXT NOT NULL,          -- direct | group
  user_id      INTEGER NOT NULL,
  emoji        TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, message_type, user_id)
);

CREATE TABLE IF NOT EXISTS message_reads (
  user_id   INTEGER NOT NULL,
  other_id  INTEGER NOT NULL,
  last_read TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, other_id)
);

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

-- ===== Motivation quotes =====
CREATE TABLE IF NOT EXISTS favourite_quotes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote_id   INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, quote_id)
);

-- ===== Password reset =====
CREATE TABLE IF NOT EXISTS reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reset_token ON reset_tokens(token);

-- ===== Flashcards =====
CREATE TABLE IF NOT EXISTS decks (
  id         SERIAL PRIMARY KEY,
  owner_id   INTEGER NOT NULL,
  name       TEXT NOT NULL,
  exam_tag   TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cards (
  id            SERIAL PRIMARY KEY,
  deck_id       INTEGER NOT NULL,
  front         TEXT NOT NULL,
  back          TEXT NOT NULL,
  interval_days INTEGER DEFAULT 0,
  ease          REAL DEFAULT 2.5,
  due_at        TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ===== Study planner =====
CREATE TABLE IF NOT EXISTS study_blocks (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  day        DATE NOT NULL,
  time       TEXT DEFAULT '',
  topic      TEXT NOT NULL,
  duration   TEXT DEFAULT '',
  note       TEXT DEFAULT '',
  color      TEXT DEFAULT 'c1',
  done       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== QBank tracker =====
CREATE TABLE IF NOT EXISTS qbank_progress (
  user_id  INTEGER NOT NULL,
  bank     TEXT NOT NULL,
  topic    TEXT NOT NULL,
  done     INTEGER DEFAULT 0,
  total    INTEGER DEFAULT 0,
  correct  INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, bank, topic)
);

CREATE TABLE IF NOT EXISTS share_grants (
  grantor_id INTEGER NOT NULL,
  grantee_id INTEGER NOT NULL,
  bank       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (grantor_id, grantee_id, bank)
);

-- ===== Notes =====
CREATE TABLE IF NOT EXISTS notes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT DEFAULT '',
  tags       TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- NOTE: profile.js had two conflicting CREATE note_shares statements; the first
-- (a copy of the notes shape) won under IF NOT EXISTS and was never queried.
-- Only the intended share schema is created here.
CREATE TABLE IF NOT EXISTS note_shares (
  id          SERIAL PRIMARY KEY,
  note_id     INTEGER NOT NULL,
  shared_by   INTEGER NOT NULL,
  shared_with INTEGER NOT NULL,
  saved       BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (note_id, shared_by, shared_with)
);

-- ===== Cloud-synced settings (theme, checklist, prefs) =====
CREATE TABLE IF NOT EXISTS user_settings (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- ===== Push notifications =====
CREATE TABLE IF NOT EXISTS push_subs (
  user_id    INTEGER NOT NULL,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, endpoint)
);

-- ===== Login rate limiting =====
CREATE TABLE IF NOT EXISTS login_attempts (
  id         SERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier
  ON login_attempts(identifier, created_at);
