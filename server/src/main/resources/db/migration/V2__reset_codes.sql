-- V2 — one-time reset codes (6-char alphanumeric, SHA-256 hashed at rest).
--
-- The original `reset_tokens` rows carried a long bearer token that was
-- returned in-band to whoever asked. Reset now issues a short code sent to
-- the account's registered email instead; only its hash is stored.
-- Idempotent (`IF NOT EXISTS`), like every V1 statement.

ALTER TABLE IF EXISTS reset_tokens
  ADD COLUMN IF NOT EXISTS code_hash TEXT;

ALTER TABLE IF EXISTS reset_tokens
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
