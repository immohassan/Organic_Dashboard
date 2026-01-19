CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  last_updated TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  url TEXT NOT NULL,
  default_editor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  platform TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  posted_date DATE,
  date_added DATE NOT NULL,
  editor TEXT NOT NULL,
  editor_override BOOLEAN NOT NULL DEFAULT FALSE,
  is_fetching BOOLEAN NOT NULL DEFAULT FALSE
);
