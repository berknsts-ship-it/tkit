-- Запустить в Supabase Dashboard → SQL Editor
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS screenshots text[] DEFAULT '{}';
