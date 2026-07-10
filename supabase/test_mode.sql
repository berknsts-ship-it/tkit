-- Миграция: режим теста на доске
-- Запустить в Supabase Dashboard → SQL Editor

-- student_id может быть null для групповых тестов
ALTER TABLE board_snapshots ALTER COLUMN student_id DROP NOT NULL;

-- group_id для привязки группового снапшота к группе
ALTER TABLE board_snapshots ADD COLUMN IF NOT EXISTS group_id UUID;

-- Поля режима теста
ALTER TABLE board_snapshots ADD COLUMN IF NOT EXISTS test_mode boolean DEFAULT false;
ALTER TABLE board_snapshots ADD COLUMN IF NOT EXISTS test_status text;         -- 'in_progress' | 'completed'
ALTER TABLE board_snapshots ADD COLUMN IF NOT EXISTS test_duration_minutes integer;
