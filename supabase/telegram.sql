-- Telegram bot integration
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE tutors
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS max_chat_id       TEXT,
  ADD COLUMN IF NOT EXISTS notify_channels   JSONB NOT NULL DEFAULT '{"telegram":true,"push":true,"max":false,"email":false}';

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS max_chat_id       TEXT,
  ADD COLUMN IF NOT EXISTS notify_channels   JSONB NOT NULL DEFAULT '{"telegram":true,"push":true,"max":false,"email":false}';

CREATE TABLE IF NOT EXISTS telegram_link_codes (
  code        TEXT PRIMARY KEY,
  tutor_id    UUID REFERENCES tutors(id) ON DELETE CASCADE,
  student_id  UUID REFERENCES students(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT one_target CHECK (
    (tutor_id IS NOT NULL)::int + (student_id IS NOT NULL)::int = 1
  )
);
-- No RLS on telegram_link_codes — accessed only by service role (bot + server actions)
