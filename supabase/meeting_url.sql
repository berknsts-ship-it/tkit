-- Добавить поле meeting_url в таблицу tutors
-- Запустить в Supabase Dashboard → SQL Editor
ALTER TABLE tutors ADD COLUMN IF NOT EXISTS meeting_url text;
