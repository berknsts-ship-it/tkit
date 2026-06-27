-- T-Kit: Multi-tenant platform for tutors
-- Run this in Supabase SQL editor after creating a new project

-- ============================================================
-- TABLES
-- ============================================================

-- Репетиторы (linked to auth.users via id)
CREATE TABLE IF NOT EXISTS tutors (
  id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email         TEXT NOT NULL,
  name          TEXT,
  subject       TEXT,                        -- предмет (необязательно)
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  plan_expires_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Ученики
CREATE TABLE IF NOT EXISTS students (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id            UUID REFERENCES tutors(id) ON DELETE CASCADE NOT NULL,
  name                TEXT NOT NULL,
  access_code         TEXT UNIQUE NOT NULL,
  notes               TEXT,
  default_price_rub   INT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Migration (run once if students table already exists):
-- ALTER TABLE students ADD COLUMN IF NOT EXISTS default_price_rub INT;

-- Занятия / расписание
CREATE TABLE IF NOT EXISTS lessons (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id        UUID REFERENCES tutors(id) ON DELETE CASCADE NOT NULL,
  student_id      UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration_min    INT DEFAULT 60,
  status          TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'missed')),
  payment_status  TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid')),
  price_rub       INT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- Migration (run once if table already exists):
-- ALTER TABLE lessons ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid'));
-- ALTER TABLE lessons ADD COLUMN IF NOT EXISTS price_rub INT;

-- Домашние задания
CREATE TABLE IF NOT EXISTS homework (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id      UUID REFERENCES tutors(id) ON DELETE CASCADE NOT NULL,
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  due_date      DATE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'checked')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Материалы (файлы через Vercel Blob)
CREATE TABLE IF NOT EXISTS materials (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id      UUID REFERENCES tutors(id) ON DELETE CASCADE NOT NULL,
  student_id    UUID REFERENCES students(id) ON DELETE SET NULL,  -- NULL = для всех учеников
  title         TEXT NOT NULL,
  file_url      TEXT,
  file_name     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Темы словаря (PRO)
CREATE TABLE IF NOT EXISTS vocabulary_topics (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id      UUID REFERENCES tutors(id) ON DELETE CASCADE NOT NULL,
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  language      TEXT NOT NULL DEFAULT 'en-US',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
-- Migration (run once if table already exists):
-- ALTER TABLE vocabulary_topics ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en-US';

-- Слова в теме (PRO)
CREATE TABLE IF NOT EXISTS vocabulary_words (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id      UUID REFERENCES vocabulary_topics(id) ON DELETE CASCADE NOT NULL,
  word          TEXT NOT NULL,
  translation   TEXT NOT NULL,
  example       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Подписки / платежи через ЮКасса
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id            UUID REFERENCES tutors(id) ON DELETE CASCADE NOT NULL,
  plan                TEXT NOT NULL DEFAULT 'pro',
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  starts_at           TIMESTAMPTZ DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL,
  yookassa_payment_id TEXT,
  amount_rub          INT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- tutors: каждый видит только свою запись
CREATE POLICY "tutors_self" ON tutors
  FOR ALL USING (auth.uid() = id);

-- students: репетитор видит только своих учеников
CREATE POLICY "students_by_tutor" ON students
  FOR ALL USING (auth.uid() = tutor_id);

-- lessons: репетитор видит только свои занятия
CREATE POLICY "lessons_by_tutor" ON lessons
  FOR ALL USING (auth.uid() = tutor_id);

-- homework: репетитор видит только своё ДЗ
CREATE POLICY "homework_by_tutor" ON homework
  FOR ALL USING (auth.uid() = tutor_id);

-- materials: репетитор видит только свои материалы
CREATE POLICY "materials_by_tutor" ON materials
  FOR ALL USING (auth.uid() = tutor_id);

-- vocabulary_topics: репетитор видит только свои темы
CREATE POLICY "vocab_topics_by_tutor" ON vocabulary_topics
  FOR ALL USING (auth.uid() = tutor_id);

-- vocabulary_words: через topic -> tutor
CREATE POLICY "vocab_words_by_tutor" ON vocabulary_words
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM vocabulary_topics t
      WHERE t.id = vocabulary_words.topic_id
        AND t.tutor_id = auth.uid()
    )
  );

-- subscriptions: репетитор видит только свои подписки
CREATE POLICY "subscriptions_by_tutor" ON subscriptions
  FOR ALL USING (auth.uid() = tutor_id);

-- Справочник (статьи, которые репетитор создаёт сам)
CREATE TABLE IF NOT EXISTS reference_articles (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id      UUID REFERENCES tutors(id) ON DELETE CASCADE NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL DEFAULT '',
  assign_to_all BOOLEAN NOT NULL DEFAULT false,  -- true = видят все ученики этого репетитора
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Назначение статей конкретным ученикам (когда assign_to_all = false)
CREATE TABLE IF NOT EXISTS reference_article_students (
  article_id    UUID REFERENCES reference_articles(id) ON DELETE CASCADE NOT NULL,
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (article_id, student_id)
);

ALTER TABLE reference_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_article_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_articles_by_tutor" ON reference_articles
  FOR ALL USING (auth.uid() = tutor_id);

CREATE POLICY "ref_article_students_by_tutor" ON reference_article_students
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM reference_articles a
      WHERE a.id = reference_article_students.article_id
        AND a.tutor_id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGER: создать запись tutors при регистрации
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_tutor()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO tutors (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_tutor();

-- ============================================================
-- FUNCTION: получить данные ученика по коду (без auth)
-- Используется из API route с service_role key
-- ============================================================

CREATE OR REPLACE FUNCTION get_student_by_code(p_code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  tutor_id UUID,
  notes TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.tutor_id, s.notes
  FROM students s
  WHERE s.access_code = p_code;
END;
$$;

-- ============================================================
-- Supabase Storage: создай bucket "board-images" (public) в Storage → Buckets
-- Policy: INSERT для auth.role() = 'authenticated', SELECT для all
-- ============================================================

-- ============================================================
-- Конспекты уроков (снэпшоты доски)
-- ============================================================

CREATE TABLE IF NOT EXISTS board_snapshots (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id    UUID REFERENCES tutors(id) ON DELETE CASCADE NOT NULL,
  student_id  UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  lesson_id   UUID REFERENCES lessons(id) ON DELETE SET NULL,   -- необязательно
  title       TEXT NOT NULL DEFAULT '',
  items       JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE board_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots_by_tutor" ON board_snapshots
  FOR ALL USING (auth.uid() = tutor_id);

-- ============================================================
-- Сообщения поддержки
-- ============================================================

CREATE TABLE IF NOT EXISTS support_messages (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Любой может отправить сообщение
CREATE POLICY "anyone_can_insert_support" ON support_messages
  FOR INSERT WITH CHECK (true);

-- Читать могут только через service_role (Supabase Dashboard)
