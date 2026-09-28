-- ============================================================================
-- MedConnect — full schema export (every CREATE/ALTER the app can inject)
-- ----------------------------------------------------------------------------
-- Sources consolidated into this file:
--   1. api/_shared/schema.sql          (base tables, run once in Neon)
--   2. api/profile.js                  (ALTER users + decks/cards/blocks/qbank/notes)
--   3. api/messages.js                 (message_reactions, message_reads)
--   4. api/_shared/push.js             (push_subs)
--   5. api/_shared/util.js             (login_attempts — used but never created in code*)
--
-- * login_attempts has no CREATE TABLE in the repo; definition below is inferred
--   from checkRateLimit()/recordAttempt() usage. medical_school / bio / profession
--   are also used by profile updates but never created in code — added here so a
--   fresh database matches what the API expects.
--
-- Safe to re-run: everything uses IF NOT EXISTS.
-- ============================================================================

-- ============================================================================
-- 1. Base schema  (api/_shared/schema.sql)
-- ============================================================================

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

-- ============================================================================
-- 2. users columns injected at runtime  (api/profile.js)
-- ============================================================================

-- Used by PUT /api/profile / matches — never created in code (assumed pre-existing)
ALTER TABLE users ADD COLUMN IF NOT EXISTS profession    TEXT DEFAULT 'medical';
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio           TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_school TEXT DEFAULT '';

-- Self-creating columns (api/profile.js)
ALTER TABLE users ADD COLUMN IF NOT EXISTS focus        TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender       TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS study_styles TEXT DEFAULT '';

-- ============================================================================
-- 3. Rate limiting  (api/_shared/util.js — checkRateLimit / recordAttempt)
-- ============================================================================

CREATE TABLE IF NOT EXISTS login_attempts (
  id         SERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier
  ON login_attempts(identifier, created_at);

-- ============================================================================
-- 4. Push subscriptions  (api/_shared/push.js — ensurePushTable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_subs (
  user_id    INTEGER NOT NULL,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, endpoint)
);

-- ============================================================================
-- 5. Messaging extras  (api/messages.js)
-- ============================================================================

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

-- ============================================================================
-- 6. Flashcards  (api/profile.js — ensureDeckTables)
-- ============================================================================

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

-- ============================================================================
-- 7. Study planner blocks  (api/profile.js — ensureBlocksTable)
-- ============================================================================

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

-- ============================================================================
-- 8. QBank tracker  (api/profile.js — ensureQbankTables)
-- ============================================================================

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

-- ============================================================================
-- 9. Notes  (api/profile.js — ensureNotesTables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT DEFAULT '',
  tags       TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- NOTE: profile.js has two conflicting CREATE note_shares statements.
-- The first (copy of notes shape with user_id) wins under IF NOT EXISTS and is
-- unused by any query; the second (share link shape) is never applied if the
-- first already ran. Intended share schema is kept below.
CREATE TABLE IF NOT EXISTS note_shares (
  id          SERIAL PRIMARY KEY,
  note_id     INTEGER NOT NULL,
  shared_by   INTEGER NOT NULL,
  shared_with INTEGER NOT NULL,
  saved       BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (note_id, shared_by, shared_with)
);

-- per-user key-value settings (theme, checklist, prefs, markers — replaces device-local storage)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
