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

-- Bot sessions: persistent state for Telegram bot
-- (replaces in-memory objects that break on Vercel cold starts)
CREATE TABLE IF NOT EXISTS bot_sessions (
  chat_id    TEXT PRIMARY KEY,
  mode       TEXT,             -- 'reg' | 'bmi' | 'ai' | 'surname' | 'name' | null
  reg_step   TEXT,             -- '0'..'5' or 'bmi_ask' | 'bmi_weight' | 'bmi_height' | 'confirm'
  reg_data   JSONB DEFAULT '{}',
  bmi_data   JSONB DEFAULT '{}',
  ai_msgs    JSONB DEFAULT '[]',  -- last 16 messages [{role,content}]
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: auto-clean stale sessions older than 24h
-- (run as a Supabase scheduled function or cron if desired)
-- DELETE FROM bot_sessions WHERE updated_at < NOW() - INTERVAL '24 hours';
