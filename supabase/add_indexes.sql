-- Запустить в Supabase Dashboard → SQL Editor
-- Индексы на часто используемых полях фильтрации

CREATE INDEX IF NOT EXISTS idx_students_tutor_id ON students(tutor_id);
CREATE INDEX IF NOT EXISTS idx_lessons_tutor_id ON lessons(tutor_id);
CREATE INDEX IF NOT EXISTS idx_lessons_student_id ON lessons(student_id);
CREATE INDEX IF NOT EXISTS idx_lessons_subscription_id ON lessons(subscription_id);
CREATE INDEX IF NOT EXISTS idx_homework_tutor_id ON homework(tutor_id);
CREATE INDEX IF NOT EXISTS idx_homework_student_id ON homework(student_id);
CREATE INDEX IF NOT EXISTS idx_board_snapshots_tutor_id ON board_snapshots(tutor_id);
CREATE INDEX IF NOT EXISTS idx_board_snapshots_student_id ON board_snapshots(student_id);
CREATE INDEX IF NOT EXISTS idx_trainer_cards_deck_id ON trainer_cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_trainer_progress_student_deck ON trainer_progress(student_id, deck_id);
CREATE INDEX IF NOT EXISTS idx_trainer_progress_card ON trainer_progress(student_id, card_id);
CREATE INDEX IF NOT EXISTS idx_groups_tutor_id ON groups(tutor_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_materials_tutor_id ON materials(tutor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tutor_id ON notifications(tutor_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tutor_id ON subscriptions(tutor_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_student_id ON subscriptions(student_id);
