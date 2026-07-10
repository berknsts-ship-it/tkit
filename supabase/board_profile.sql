-- Профиль доски: предмет и фон
-- Запустить в Supabase Dashboard → SQL Editor
ALTER TABLE tutors ADD COLUMN IF NOT EXISTS subject_profile text DEFAULT 'other';
ALTER TABLE tutors ADD COLUMN IF NOT EXISTS board_bg text DEFAULT 'dots';
