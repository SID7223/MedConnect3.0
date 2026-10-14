-- V5 — MCQ answer log + wrong-question shares (ST3 Qbank MCQs).
--
-- mcq_answers keeps the latest attempt per (user, question): answering
-- correctly later flips the row, so the Wrong list updates automatically.
-- mcq_shares is the share payload: up to 20 question ids + optional message,
-- opened in-app by the recipient (question text never leaves the app).

CREATE TABLE IF NOT EXISTS mcq_answers (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  subject     TEXT NOT NULL DEFAULT '',
  correct     BOOLEAN NOT NULL DEFAULT FALSE,
  answered_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_mcq_answers_user ON mcq_answers(user_id);

CREATE TABLE IF NOT EXISTS mcq_shares (
  id           SERIAL PRIMARY KEY,
  from_user    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_ids TEXT NOT NULL DEFAULT '[]',
  message      TEXT DEFAULT '',
  opened       BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mcq_shares_to ON mcq_shares(to_user, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcq_shares_from ON mcq_shares(from_user, created_at DESC);
