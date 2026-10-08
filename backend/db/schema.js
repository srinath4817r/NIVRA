// backend/db/schema.js — database schema (idempotent; applied on every cold start)
// Kept as a JS module, not a .sql file: Vercel compiles each source file to its own .cjs and does
// not copy other files next to them, so reading a file at runtime fails in production.

module.exports = `
-- NIVRA user data schema (idempotent; runs on every cold start)

CREATE TABLE IF NOT EXISTS users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT UNIQUE,
  phone              TEXT UNIQUE,
  google_sub         TEXT UNIQUE,
  password_hash      TEXT,
  name               TEXT NOT NULL,
  avatar_url         TEXT,
  provider           TEXT NOT NULL,           -- email | google | mobile | guest
  is_guest           BOOLEAN NOT NULL DEFAULT FALSE,
  profile            JSONB NOT NULL DEFAULT '{}'::jsonb,   -- eligibility answers, language
  emergency_contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_codes_phone_idx ON otp_codes (phone, created_at DESC);

CREATE TABLE IF NOT EXISTS trackers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id       TEXT,                          -- content id (sch-1, gov-2…) when tracked from a card
  title         TEXT NOT NULL,
  type          TEXT NOT NULL,
  reference_no  TEXT NOT NULL,
  applied_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  status        TEXT NOT NULL DEFAULT 'Submitted - Verification Pending',
  steps         JSONB NOT NULL,
  next_reminder TEXT,
  deadline      DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trackers_user_idx ON trackers (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS trackers_user_item_uq ON trackers (user_id, item_id) WHERE item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS saved_items (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS uploads (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  mime_type  TEXT NOT NULL,
  size_bytes INT NOT NULL,
  data       BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  category       TEXT NOT NULL,
  location       TEXT NOT NULL,
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  description    TEXT NOT NULL,
  severity       TEXT NOT NULL,
  contact_number TEXT,
  upload_id      UUID REFERENCES uploads(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'Received',
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_user_idx ON reports (user_id, created_at DESC);
`;
