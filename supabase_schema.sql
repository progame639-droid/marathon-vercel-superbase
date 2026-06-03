-- Run this in Supabase SQL Editor

-- Table for Google auth users
CREATE TABLE IF NOT EXISTS auth_users (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  google_id   TEXT UNIQUE NOT NULL,
  email       TEXT,
  name        TEXT,
  image       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Table for marathon participants
CREATE TABLE IF NOT EXISTS participants (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id    TEXT NOT NULL,          -- google sub (session.user.id)
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  surname     TEXT NOT NULL,
  gender      TEXT DEFAULT 'Мужской',
  role        TEXT DEFAULT 'Бегун',
  country     TEXT,
  dob         DATE,
  bmi         NUMERIC(5,2),
  photo       TEXT,                   -- base64 data URL
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS idx_participants_owner ON participants(owner_id);

-- RLS: disable (API routes use service role key, so no RLS needed)
-- Or enable and add policy if you want extra security:
-- ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
