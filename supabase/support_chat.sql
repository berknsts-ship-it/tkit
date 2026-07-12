-- Запустить в Supabase Dashboard → SQL Editor

-- Привязка сообщения к репетитору
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES auth.users(id);

-- Текст ответа от поддержки (вместо email)
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS reply_text text;
