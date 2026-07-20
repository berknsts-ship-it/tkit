-- Запустить в Supabase Dashboard → SQL Editor
-- Отметка о том, что репетитор прочитал ответ поддержки

ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS tutor_read_at TIMESTAMPTZ;
